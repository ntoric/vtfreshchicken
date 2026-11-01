package imaging

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestThumbNameRoundTrip(t *testing.T) {
	name := ThumbName("abc123.png")
	if name != "abc123.png.jpg" {
		t.Fatalf("ThumbName = %q", name)
	}
	src, ok := SourceName(name)
	if !ok || src != "abc123.png" {
		t.Fatalf("SourceName = %q, %v", src, ok)
	}
	for _, bad := range []string{"abc.jpg", ".jpg", "abc.png", "abc.png.webp"} {
		if _, ok := SourceName(bad); ok {
			t.Errorf("SourceName(%q) should fail", bad)
		}
	}
}

func TestGenerateDownscalesAndFlattens(t *testing.T) {
	// 2000x1000 fully transparent PNG -> 640x320 white JPEG.
	src := image.NewNRGBA(image.Rect(0, 0, 2000, 1000))
	var buf bytes.Buffer
	if err := png.Encode(&buf, src); err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	if err := Generate(bytes.NewReader(buf.Bytes()), &out); err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(&out)
	if err != nil {
		t.Fatal(err)
	}
	if b := img.Bounds(); b.Dx() != 640 || b.Dy() != 320 {
		t.Fatalf("size = %dx%d, want 640x320", b.Dx(), b.Dy())
	}
	r, g, b, _ := img.At(10, 10).RGBA()
	if r>>8 < 240 || g>>8 < 240 || b>>8 < 240 {
		t.Fatalf("transparent pixel not flattened to white: %v %v %v", r>>8, g>>8, b>>8)
	}
}

func TestGenerateDoesNotUpscale(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 100, 50))
	var buf bytes.Buffer
	_ = png.Encode(&buf, src)
	var out bytes.Buffer
	if err := Generate(bytes.NewReader(buf.Bytes()), &out); err != nil {
		t.Fatal(err)
	}
	cfg, err := jpeg.DecodeConfig(&out)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 100 || cfg.Height != 50 {
		t.Fatalf("size = %dx%d, want 100x50", cfg.Width, cfg.Height)
	}
}

func TestApplyOrientationRotate90(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 4, 2))
	src.SetRGBA(0, 0, color.RGBA{255, 0, 0, 255}) // top-left red
	out := applyOrientation(src, 6)               // rotate 90 CW
	if b := out.Bounds(); b.Dx() != 2 || b.Dy() != 4 {
		t.Fatalf("size = %dx%d, want 2x4", b.Dx(), b.Dy())
	}
	if out.RGBAAt(1, 0) != (color.RGBA{255, 0, 0, 255}) {
		t.Fatalf("top-left pixel should move to top-right after 90 CW rotation")
	}
}

func TestExifOrientation(t *testing.T) {
	// Minimal JPEG prefix: SOI + APP1(Exif, big-endian TIFF, IFD0 with one
	// Orientation=6 entry) + SOS marker.
	tiff := []byte{
		'M', 'M', 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, // header, IFD0 at 8
		0x00, 0x01, // 1 entry
		0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // orientation=6
		0x00, 0x00, 0x00, 0x00, // next IFD
	}
	payload := append([]byte("Exif\x00\x00"), tiff...)
	segLen := len(payload) + 2
	data := []byte{0xFF, 0xD8, 0xFF, 0xE1, byte(segLen >> 8), byte(segLen)}
	data = append(data, payload...)
	data = append(data, 0xFF, 0xDA)
	if o := exifOrientation(bytes.NewReader(data)); o != 6 {
		t.Fatalf("orientation = %d, want 6", o)
	}
	if o := exifOrientation(bytes.NewReader([]byte{0x89, 'P', 'N', 'G'})); o != 1 {
		t.Fatalf("non-JPEG orientation = %d, want 1", o)
	}
}

func TestGenerateFileRejectsGarbage(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "x.jpg")
	_ = os.WriteFile(src, []byte("not an image"), 0o644)
	dst := filepath.Join(dir, ThumbDir, ThumbName("x.jpg"))
	if err := GenerateFile(src, dst); err == nil {
		t.Fatal("expected error for garbage input")
	}
	if _, err := os.Stat(dst); !os.IsNotExist(err) {
		t.Fatal("no thumbnail should be written on failure")
	}
}
