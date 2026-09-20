package middleware

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/services"
)

const (
	// CtxIdempotencyRecordID stores the idempotency record ID for handlers that need it (e.g. checkout).
	CtxIdempotencyRecordID = "idempotency_record_id"
)

// bodyCaptureWriter wraps gin.ResponseWriter to capture the response body for caching.
type bodyCaptureWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *bodyCaptureWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *bodyCaptureWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// hashRequest computes a SHA-256 hash of the request body for idempotency verification.
func hashRequest(body []byte) string {
	if len(body) == 0 {
		return ""
	}
	h := sha256.Sum256(body)
	return hex.EncodeToString(h[:])
}

// Idempotency returns a Gin middleware that enforces idempotency for the given scope.
// If the client sends an "Idempotency-Key" header, the middleware:
//  1. Checks if a response is already cached for (tenant, scope, key) → replays it
//  2. If a request is in-flight → returns 409 Conflict
//  3. Otherwise, processes the request and caches the response (unless 5xx)
//
// If no header is present, the request proceeds normally without idempotency protection.
func Idempotency(store *services.IdempotencyStore, scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("Idempotency-Key")
		if key == "" {
			c.Next()
			return
		}

		// Limit key length to prevent abuse
		if len(key) > 256 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "idempotency key too long (max 256 chars)"})
			return
		}

		// Read and restore the request body so handlers can still read it
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))

		requestHash := hashRequest(bodyBytes)

		// Resolve tenant and user from context
		var tenantID *uuid.UUID
		if v, ok := c.Get(CtxTenantID); ok {
			if tid, ok2 := v.(uuid.UUID); ok2 && tid != uuid.Nil {
				tenantID = &tid
			}
		}
		var userID *uuid.UUID
		if v, ok := c.Get(CtxUserID); ok {
			if uid, ok2 := v.(uuid.UUID); ok2 && uid != uuid.Nil {
				userID = &uid
			}
		}

		// Try to begin processing
		rec, err := store.BeginProcessing(c.Request.Context(), tenantID, userID, key, scope, requestHash)
		if err != nil {
			if err == services.ErrIdempotencyConflict {
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "a request with this idempotency key is already being processed"})
				return
			}
			if err == services.ErrIdempotencyKeyMismatch {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "this idempotency key was already used with a different request body"})
				return
			}
			// On unexpected DB errors, proceed without idempotency (fail open)
			c.Next()
			return
		}

		// If the record is already completed, replay the cached response
		if rec.Status == "completed" {
			contentType := "application/json"
			if rec.ResponseBody != nil {
				// Verify it's valid JSON; if not, it might have been stored differently
				var check interface{}
				if json.Unmarshal(rec.ResponseBody, &check) != nil {
					contentType = "text/plain"
				}
			}
			c.Data(rec.ResponseStatus, contentType, rec.ResponseBody)
			c.Abort()
			return
		}

		// Store the record ID in context so handlers can use it (e.g. to set order.idempotency_key)
		c.Set(CtxIdempotencyRecordID, rec.ID)

		// Wrap the response writer to capture the body
		captureWriter := &bodyCaptureWriter{
			ResponseWriter: c.Writer,
			body:           &bytes.Buffer{},
		}
		c.Writer = captureWriter

		c.Next()

		// After handler completes, cache the response (unless 5xx — allow retry)
		status := c.Writer.Status()
		if status >= 500 {
			// Don't cache server errors — let the client retry with the same key
			_ = store.AbortProcessing(c.Request.Context(), rec.ID)
			return
		}

		responseBody := captureWriter.body.Bytes()
		_ = store.CompleteProcessing(c.Request.Context(), rec.ID, status, responseBody)
	}
}
