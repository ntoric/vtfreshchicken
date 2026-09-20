package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/trucommerce/backend/internal/config"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// ExportHandler handles bulk export endpoints.
type ExportHandler struct {
	store   *services.Store
	cfg     *config.Config
	emailH  *EmailHandler
}

func NewExportHandler(store *services.Store, cfg *config.Config, emailH *EmailHandler) *ExportHandler {
	return &ExportHandler{store: store, cfg: cfg, emailH: emailH}
}

// CreateExport creates a new async export job.
func (h *ExportHandler) CreateExport(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)
	var req models.ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Type == "" {
		errResponse(c, http.StatusBadRequest, "type is required")
		return
	}
	if _, ok := services.ExportRegistry[req.Type]; !ok {
		errResponse(c, http.StatusBadRequest, "unknown export type: "+req.Type)
		return
	}
	if req.Format == "" {
		req.Format = "csv"
	}
	job, err := h.store.CreateExportJob(c.Request.Context(), tid, uid, req.Type, req.Format, req.Filters, req.Email)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, job)
}

// ListExports lists export jobs for the tenant.
func (h *ExportHandler) ListExports(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	jobs, total, err := h.store.ListExportJobs(c.Request.Context(), tid, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": jobs, "total": total, "limit": limit, "offset": offset})
}

// GetExport returns a single export job by ID (for polling status/progress).
func (h *ExportHandler) GetExport(c *gin.Context) {
	tid := tenantID(c)
	jobID, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	job, err := h.store.GetExportJob(c.Request.Context(), tid, jobID)
	if err != nil {
		notFoundOrErr(c, err, "export job not found")
		return
	}
	c.JSON(http.StatusOK, job)
}

// DownloadExport serves the generated CSV file for a completed job.
func (h *ExportHandler) DownloadExport(c *gin.Context) {
	tid := tenantID(c)
	jobID, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	job, err := h.store.GetExportJob(c.Request.Context(), tid, jobID)
	if err != nil {
		notFoundOrErr(c, err, "export job not found")
		return
	}
	if job.Status != "completed" || job.FilePath == "" {
		errResponse(c, http.StatusBadRequest, "export is not ready or has no file")
		return
	}
	fullPath := filepath.Join("/app/uploads", job.FilePath)
	f, err := os.Open(fullPath)
	if err != nil {
		errResponse(c, http.StatusNotFound, "export file not found on disk")
		return
	}
	defer f.Close()
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=\""+job.FileName+"\"")
	c.File(fullPath)
}

// ListExportTypes returns the available export types and their metadata.
func (h *ExportHandler) ListExportTypes(c *gin.Context) {
	types := make([]gin.H, 0, len(services.ExportRegistry))
	for key, et := range services.ExportRegistry {
		types = append(types, gin.H{"key": key, "name": et.Name, "description": et.Description})
	}
	c.JSON(http.StatusOK, gin.H{"types": types})
}

// EstimateExportSize returns the estimated row count for an export type + filters (for the UI to decide whether to prompt for email).
func (h *ExportHandler) EstimateExportSize(c *gin.Context) {
	tid := tenantID(c)
	typ := c.Query("type")
	if typ == "" {
		errResponse(c, http.StatusBadRequest, "type is required")
		return
	}
	et, ok := services.ExportRegistry[typ]
	if !ok {
		errResponse(c, http.StatusBadRequest, "unknown export type: "+typ)
		return
	}
	filters := make(map[string]string)
	for _, k := range []string{"status", "search", "gateway", "type", "movement_type", "source", "from", "to"} {
		if v := c.Query(k); v != "" {
			filters[k] = v
		}
	}
	total, err := et.CountFn(c.Request.Context(), h.store, tid, filters)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"type": typ, "estimated_rows": total})
}
