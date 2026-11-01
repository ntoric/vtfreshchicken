package handlers

import (
	"bytes"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func newUploadRouter(t *testing.T) (*gin.Engine, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	h := NewUploadHandler(dir, 10<<20, []string{"image/png", "image/jpeg"})
	r := gin.New()
	r.GET("/uploads/*filepath", h.ServeUploads)
	return r, dir
}

func get(r http.Handler, url string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
	return w
}

func TestServeUploadsLazyThumbnail(t *testing.T) {
	r, dir := newUploadRouter(t)
	var buf bytes.Buffer
	_ = png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 1600, 1200)))
	if err := os.WriteFile(filepath.Join(dir, "legacy.png"), buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}

	w := get(r, "/uploads/thumbs/legacy.png.jpg")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "image/jpeg" {
		t.Fatalf("content-type = %q", ct)
	}
	if w.Header().Get("Cache-Control") != uploadCacheControl {
		t.Fatalf("missing immutable cache header")
	}
	cfg, err := jpeg.DecodeConfig(w.Body)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 640 || cfg.Height != 480 {
		t.Fatalf("thumb size = %dx%d", cfg.Width, cfg.Height)
	}
	if _, err := os.Stat(filepath.Join(dir, "thumbs", "legacy.png.jpg")); err != nil {
		t.Fatalf("thumbnail not cached on disk: %v", err)
	}

	// Original is still served untouched.
	if w := get(r, "/uploads/legacy.png"); w.Code != http.StatusOK || w.Body.Len() != buf.Len() {
		t.Fatalf("original: status=%d len=%d", w.Code, w.Body.Len())
	}
}

func TestServeUploadsThumbnailFallsBackToOriginal(t *testing.T) {
	r, dir := newUploadRouter(t)
	_ = os.WriteFile(filepath.Join(dir, "broken.jpg"), []byte("not really a jpeg"), 0o644)
	w := get(r, "/uploads/thumbs/broken.jpg.jpg")
	if w.Code != http.StatusOK || w.Body.String() != "not really a jpeg" {
		t.Fatalf("expected original fallback, got %d %q", w.Code, w.Body.String())
	}
}

func TestServeUploadsNotFound(t *testing.T) {
	r, _ := newUploadRouter(t)
	for _, u := range []string{
		"/uploads/missing.png",
		"/uploads/thumbs/missing.png.jpg",
		"/uploads/thumbs/",
		"/uploads/../../etc/passwd",
		"/uploads/",
	} {
		if w := get(r, u); w.Code != http.StatusNotFound {
			t.Errorf("%s: status = %d, want 404", u, w.Code)
		}
	}
}
