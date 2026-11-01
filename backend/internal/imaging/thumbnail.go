// Package imaging generates compressed thumbnails for uploaded images.
//
// Thumbnails are JPEGs bounded to MaxThumbDim on their longest side, with
// EXIF orientation applied and transparency flattened onto white. They are
// used by storefront product cards/lists so the full-size original is only
// downloaded on the product detail page.
package imaging

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"os"
	"path/filepath"

	_ "image/gif" // register decoders
	_ "image/png"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	// MaxThumbDim is the longest edge of a thumbnail in pixels. Cards render at
	// ~25-50vw, so 640px covers 2x DPR on typical grid widths.
	MaxThumbDim = 640
	// ThumbQuality is the JPEG quality used for thumbnails.
	ThumbQuality = 78
	// maxSourcePixels guards against decompression bombs (~50 MP).
	maxSourcePixels = 50_000_000
)

// ThumbDir is the sub-directory (inside the upload dir) holding thumbnails.
const ThumbDir = "thumbs"

// ThumbName returns the thumbnail file name for an uploaded file name,
// e.g. "abc123.png" -> "abc123.png.jpg". Keeping the original extension makes
// the source unambiguous when a thumbnail is generated lazily.
func ThumbName(filename string) string { return filename + ".jpg" }

// SourceName is the inverse of ThumbName. ok is false for names that are not
// thumbnail names.
func SourceName(thumbName string) (string, bool) {
	if filepath.Ext(thumbName) != ".jpg" || len(thumbName) <= len(".jpg") {
		return "", false
	}
	src := thumbName[:len(thumbName)-len(".jpg")]
	if filepath.Ext(src) == "" {
		return "", false
	}
	return src, true
}

// GenerateFile reads srcPath, writes a thumbnail to dstPath (atomically via a
// temp file + rename) and returns nil on success.
func GenerateFile(srcPath, dstPath string) error {
	data, err := os.ReadFile(srcPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dstPath), ".thumb-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op after a successful rename

	w := bufio.NewWriter(tmp)
	if err := Generate(bytes.NewReader(data), w); err != nil {
		tmp.Close()
		return err
	}
	if err := w.Flush(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, dstPath)
}

// Generate decodes an image from r and writes a JPEG thumbnail to w.
func Generate(r io.ReadSeeker, w io.Writer) error {
	cfg, _, err := image.DecodeConfig(r)
	if err != nil {
		return fmt.Errorf("decode config: %w", err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > maxSourcePixels {
		return fmt.Errorf("unsupported image dimensions %dx%d", cfg.Width, cfg.Height)
	}
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return err
	}
	orientation := exifOrientation(r)
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return err
	}
	src, _, err := image.Decode(r)
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	thumb := Resize(src, MaxThumbDim)
	thumb = applyOrientation(thumb, orientation)
	return jpeg.Encode(w, thumb, &jpeg.Options{Quality: ThumbQuality})
}

// Resize scales src to fit within maxDim x maxDim (never upscaling) and
// flattens it onto an opaque white background.
func Resize(src image.Image, maxDim int) *image.RGBA {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > maxDim || h > maxDim {
		if w >= h {
			h = max(1, h*maxDim/w)
			w = maxDim
		} else {
			w = max(1, w*maxDim/h)
			h = maxDim
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}

// applyOrientation rotates/flips img according to an EXIF orientation value
// (1-8). Values outside that range return img unchanged.
func applyOrientation(img *image.RGBA, o int) *image.RGBA {
	if o < 2 || o > 8 {
		return img
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	dw, dh := w, h
	if o >= 5 { // 5-8 swap axes
		dw, dh = h, w
	}
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var nx, ny int
			switch o {
			case 2: // mirror horizontal
				nx, ny = w-1-x, y
			case 3: // rotate 180
				nx, ny = w-1-x, h-1-y
			case 4: // mirror vertical
				nx, ny = x, h-1-y
			case 5: // transpose
				nx, ny = y, x
			case 6: // rotate 90 CW
				nx, ny = h-1-y, x
			case 7: // transverse
				nx, ny = h-1-y, w-1-x
			case 8: // rotate 90 CCW
				nx, ny = y, w-1-x
			}
			dst.SetRGBA(nx, ny, img.RGBAAt(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

// exifOrientation returns the EXIF orientation tag of a JPEG stream, or 1 if
// absent/unparseable. Only the APP1 segment is read.
func exifOrientation(r io.Reader) int {
	br := bufio.NewReader(r)
	var soi [2]byte
	if _, err := io.ReadFull(br, soi[:]); err != nil || soi != [2]byte{0xFF, 0xD8} {
		return 1
	}
	for {
		var marker [2]byte
		if _, err := io.ReadFull(br, marker[:]); err != nil || marker[0] != 0xFF {
			return 1
		}
		// SOS / EOI: no more metadata segments.
		if marker[1] == 0xDA || marker[1] == 0xD9 {
			return 1
		}
		var lenBuf [2]byte
		if _, err := io.ReadFull(br, lenBuf[:]); err != nil {
			return 1
		}
		segLen := int(binary.BigEndian.Uint16(lenBuf[:])) - 2
		if segLen < 0 {
			return 1
		}
		seg := make([]byte, segLen)
		if _, err := io.ReadFull(br, seg); err != nil {
			return 1
		}
		if marker[1] == 0xE1 && len(seg) > 6 && string(seg[:6]) == "Exif\x00\x00" {
			if o, err := parseTIFFOrientation(seg[6:]); err == nil {
				return o
			}
			return 1
		}
	}
}

func parseTIFFOrientation(t []byte) (int, error) {
	if len(t) < 8 {
		return 0, errors.New("short tiff")
	}
	var bo binary.ByteOrder
	switch string(t[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return 0, errors.New("bad byte order")
	}
	off := int(bo.Uint32(t[4:8]))
	if off < 0 || off+2 > len(t) {
		return 0, errors.New("bad ifd offset")
	}
	n := int(bo.Uint16(t[off : off+2]))
	for i := 0; i < n; i++ {
		e := off + 2 + i*12
		if e+12 > len(t) {
			break
		}
		if bo.Uint16(t[e:e+2]) == 0x0112 {
			return int(bo.Uint16(t[e+8 : e+10])), nil
		}
	}
	return 0, errors.New("no orientation")
}
