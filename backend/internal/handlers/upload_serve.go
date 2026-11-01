package handlers

import (
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/trucommerce/backend/internal/imaging"
)

// Uploaded files get random names, so their content never changes: let
// browsers and CDNs cache them for a year.
const uploadCacheControl = "public, max-age=31536000, immutable"

// thumbSem bounds concurrent thumbnail generation (decoding a large photo can
// take tens of MB of RAM and noticeable CPU).
var thumbSem = make(chan struct{}, 2)

// makeThumbnail creates the thumbnail for an uploaded file and returns its
// public URL, or "" if generation failed (e.g. a format the decoder cannot
// read). Failures are non-fatal: the storefront falls back to the original.
func (h *UploadHandler) makeThumbnail(filename string) string {
	thumbSem <- struct{}{}
	defer func() { <-thumbSem }()

	thumbName := imaging.ThumbName(filename)
	dst := filepath.Join(h.uploadDir, imaging.ThumbDir, thumbName)
	if err := imaging.GenerateFile(filepath.Join(h.uploadDir, filename), dst); err != nil {
		log.Printf("thumbnail: %s: %v", filename, err)
		return ""
	}
	return "/uploads/" + imaging.ThumbDir + "/" + thumbName
}

// ServeUploads serves GET/HEAD /uploads/*filepath. Requests under
// /uploads/thumbs/ are generated on first access when missing (covers images
// uploaded before thumbnails existed); if a thumbnail cannot be produced the
// original image is served instead so cards never break.
func (h *UploadHandler) ServeUploads(c *gin.Context) {
	rel := path.Clean("/" + c.Param("filepath"))
	if rel == "/" {
		c.Status(http.StatusNotFound)
		return
	}

	thumbPrefix := "/" + imaging.ThumbDir + "/"
	if strings.HasPrefix(rel, thumbPrefix) {
		h.serveThumbnail(c, strings.TrimPrefix(rel, thumbPrefix))
		return
	}
	h.serveFile(c, filepath.Join(h.uploadDir, filepath.FromSlash(rel)))
}

func (h *UploadHandler) serveThumbnail(c *gin.Context, thumbName string) {
	if strings.Contains(thumbName, "/") {
		c.Status(http.StatusNotFound)
		return
	}
	thumbPath := filepath.Join(h.uploadDir, imaging.ThumbDir, thumbName)
	if fileExists(thumbPath) {
		h.serveFile(c, thumbPath)
		return
	}

	srcName, ok := imaging.SourceName(thumbName)
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	srcPath := filepath.Join(h.uploadDir, srcName)
	if !fileExists(srcPath) {
		c.Status(http.StatusNotFound)
		return
	}
	if h.makeThumbnail(srcName) != "" && fileExists(thumbPath) {
		h.serveFile(c, thumbPath)
		return
	}
	h.serveFile(c, srcPath)
}

func (h *UploadHandler) serveFile(c *gin.Context, p string) {
	st, err := os.Stat(p)
	if err != nil || st.IsDir() {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", uploadCacheControl)
	http.ServeFile(c.Writer, c.Request, p)
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}
