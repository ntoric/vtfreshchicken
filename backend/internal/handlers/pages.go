package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// PagesHandler handles store page builder endpoints.
type PagesHandler struct {
	store *services.Store
}

func NewPagesHandler(store *services.Store) *PagesHandler {
	return &PagesHandler{store: store}
}

// ListPages returns the store pages for the tenant (paginated).
func (h *PagesHandler) ListPages(c *gin.Context) {
	tid := tenantID(c)
	limit, offset := pagingParams(c)
	pages, total, err := h.store.ListStorePagesPaged(c.Request.Context(), tid, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": pages, "total": total, "limit": limit, "offset": offset})
}

// GetPage returns a single store page by ID.
func (h *PagesHandler) GetPage(c *gin.Context) {
	tid := tenantID(c)
	pid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	page, err := h.store.GetStorePage(c.Request.Context(), tid, pid)
	if err != nil {
		notFoundOrErr(c, err, "page not found")
		return
	}
	c.JSON(http.StatusOK, page)
}

// CreatePage creates a new store page.
func (h *PagesHandler) CreatePage(c *gin.Context) {
	tid := tenantID(c)
	var req models.StorePageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Slug == "" {
		errResponse(c, http.StatusBadRequest, "slug is required")
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	if req.PageType == "" {
		req.PageType = "custom"
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	page := &models.StorePage{
		TenantID:        tid,
		Slug:            req.Slug,
		Title:           req.Title,
		PageType:        req.PageType,
		Status:          req.Status,
		Blocks:          req.Blocks,
		MetaTitle:       req.MetaTitle,
		MetaDescription: req.MetaDescription,
	}
	if err := h.store.CreateStorePage(c.Request.Context(), page); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusCreated, page)
}

// UpdatePage updates a store page.
func (h *PagesHandler) UpdatePage(c *gin.Context) {
	tid := tenantID(c)
	pid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	var req models.StorePageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Slug == "" {
		errResponse(c, http.StatusBadRequest, "slug is required")
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	if req.PageType == "" {
		req.PageType = "custom"
	}
	if req.Status == "" {
		req.Status = "draft"
	}
	page, err := h.store.UpdateStorePage(c.Request.Context(), tid, pid, &req)
	if err != nil {
		notFoundOrErr(c, err, "page not found")
		return
	}
	c.JSON(http.StatusOK, page)
}

// DeletePage deletes a store page (system pages are protected).
func (h *PagesHandler) DeletePage(c *gin.Context) {
	tid := tenantID(c)
	pid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteStorePage(c.Request.Context(), tid, pid); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

// PublicGetPage returns a published page by slug (for storefront rendering).
func (h *PagesHandler) PublicGetPage(c *gin.Context) {
	tid := tenantID(c)
	if !h.store.IsModuleEnabled(c.Request.Context(), tid, services.ModulePageBuilder) {
		errResponse(c, http.StatusNotFound, "page not found")
		return
	}
	slug := c.Param("slug")
	if slug == "" {
		errResponse(c, http.StatusBadRequest, "slug is required")
		return
	}
	page, err := h.store.GetStorePageBySlug(c.Request.Context(), tid, slug)
	if err != nil {
		notFoundOrErr(c, err, "page not found")
		return
	}
	c.JSON(http.StatusOK, page)
}
