package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// UploadHandler handles multipart file uploads for product images.
type UploadHandler struct {
	uploadDir       string
	maxSize         int64
	allowedTypes    map[string]bool
	allowedExts     map[string]bool
}

func NewUploadHandler(uploadDir string, maxSize int64, allowedTypes []string) *UploadHandler {
	types := make(map[string]bool)
	exts := make(map[string]bool)
	for _, t := range allowedTypes {
		types[t] = true
		// Map MIME type to extension
		switch t {
		case "image/jpeg":
			exts[".jpg"] = true
			exts[".jpeg"] = true
		case "image/png":
			exts[".png"] = true
		case "image/webp":
			exts[".webp"] = true
		case "image/gif":
			exts[".gif"] = true
		}
	}
	// Ensure upload directory exists
	_ = os.MkdirAll(uploadDir, 0755)
	return &UploadHandler{
		uploadDir:    uploadDir,
		maxSize:      maxSize,
		allowedTypes: types,
		allowedExts:  exts,
	}
}

// UploadImage handles single-file image upload.
// Returns the public URL path for the uploaded file.
func (h *UploadHandler) UploadImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		errResponse(c, http.StatusBadRequest, "no file provided: "+err.Error())
		return
	}

	if file.Size > h.maxSize {
		errResponse(c, http.StatusRequestEntityTooLarge,
			fmt.Sprintf("file too large: max %d bytes, got %d", h.maxSize, file.Size))
		return
	}

	contentType := file.Header.Get("Content-Type")
	if !h.allowedTypes[contentType] {
		errResponse(c, http.StatusBadRequest, "unsupported file type: "+contentType)
		return
	}

	// Validate extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !h.allowedExts[ext] {
		errResponse(c, http.StatusBadRequest, "unsupported file extension: "+ext)
		return
	}

	// Generate unique filename
	randBytes := make([]byte, 8)
	_, _ = rand.Read(randBytes)
	filename := fmt.Sprintf("%s%s", hex.EncodeToString(randBytes), ext)
	destPath := filepath.Join(h.uploadDir, filename)

	if err := c.SaveUploadedFile(file, destPath); err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to save file: "+err.Error())
		return
	}

	// Return the public URL path — served by the static file server at /uploads/
	url := "/uploads/" + filename
	c.JSON(http.StatusOK, gin.H{
		"url":      url,
		"filename": filename,
		"size":     file.Size,
		"type":     contentType,
	})
}

// UploadImages handles multiple-file image upload.
// Returns an array of public URL paths.
func (h *UploadHandler) UploadImages(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid form data: "+err.Error())
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		// Try single "file" field too
		files = form.File["file"]
	}
	if len(files) == 0 {
		errResponse(c, http.StatusBadRequest, "no files provided")
		return
	}

	results := make([]gin.H, 0, len(files))
	errors := make([]gin.H, 0)

	for _, file := range files {
		if file.Size > h.maxSize {
			errors = append(errors, gin.H{
				"filename": file.Filename,
				"error":    fmt.Sprintf("file too large (max %d bytes)", h.maxSize),
			})
			continue
		}

		contentType := file.Header.Get("Content-Type")
		if !h.allowedTypes[contentType] {
			errors = append(errors, gin.H{
				"filename": file.Filename,
				"error":    "unsupported file type: " + contentType,
			})
			continue
		}

		ext := strings.ToLower(filepath.Ext(file.Filename))
		if !h.allowedExts[ext] {
			errors = append(errors, gin.H{
				"filename": file.Filename,
				"error":    "unsupported file extension: " + ext,
			})
			continue
		}

		randBytes := make([]byte, 8)
		_, _ = rand.Read(randBytes)
		filename := fmt.Sprintf("%s%s", hex.EncodeToString(randBytes), ext)
		destPath := filepath.Join(h.uploadDir, filename)

		if err := c.SaveUploadedFile(file, destPath); err != nil {
			errors = append(errors, gin.H{
				"filename": file.Filename,
				"error":    "failed to save: " + err.Error(),
			})
			continue
		}

		results = append(results, gin.H{
			"url":      "/uploads/" + filename,
			"filename": filename,
			"size":     file.Size,
			"type":     contentType,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"uploaded": results,
		"errors":   errors,
		"total":    len(results),
	})
}
