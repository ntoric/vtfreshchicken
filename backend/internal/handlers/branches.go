package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type BranchHandler struct {
	store *services.Store
}

func NewBranchHandler(store *services.Store) *BranchHandler {
	return &BranchHandler{store: store}
}

// ListPublic returns active branches with their service areas — used by the
// storefront location picker and the backoffice branch switcher.
func (h *BranchHandler) ListPublic(c *gin.Context) {
	branches, err := h.store.ListActiveBranches(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if branches == nil {
		branches = []models.Branch{}
	}
	c.JSON(http.StatusOK, gin.H{"items": branches})
}

// DeliveryCheck reports whether a location is serviceable and which branches
// can fulfil it. Accepts ?lat=&lng= (point check) or ?area= (name match).
// Response: serviceable + branch (nearest match, auto-selected) + branches
// (all eligible matches, nearest-first — the customer may switch between them).
func (h *BranchHandler) DeliveryCheck(c *gin.Context) {
	tid := tenantID(c)
	var lat, lng *float64
	if v := c.Query("lat"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lat = &f
		}
	}
	if v := c.Query("lng"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			lng = &f
		}
	}
	area := c.Query("area")

	enabled, err := h.store.HasActiveBranches(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !enabled {
		c.JSON(http.StatusOK, gin.H{"serviceable": true, "branch": nil, "branches": []services.BranchMatch{}})
		return
	}

	matches := []services.BranchMatch{}
	if lat != nil && lng != nil {
		matches, err = h.store.ServiceableBranches(c.Request.Context(), tid, *lat, *lng)
		if err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
	}
	if len(matches) == 0 && area != "" {
		matches, err = h.store.BranchesCoveringArea(c.Request.Context(), tid, area)
		if err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
	}

	var branch *models.Branch
	if len(matches) > 0 {
		branch = matches[0].Branch
	}
	c.JSON(http.StatusOK, gin.H{"serviceable": branch != nil, "branch": branch, "branches": matches})
}

// ---------------- Admin CRUD ----------------

func (h *BranchHandler) List(c *gin.Context) {
	limit, offset := pagingParams(c)
	branches, total, err := h.store.ListBranchesPaged(c.Request.Context(), tenantID(c), limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if branches == nil {
		branches = []models.Branch{}
	}
	c.JSON(http.StatusOK, gin.H{"items": branches, "total": total, "limit": limit, "offset": offset})
}

func (h *BranchHandler) Get(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	b, err := h.store.GetBranch(c.Request.Context(), tenantID(c), id)
	if err != nil {
		notFoundOrErr(c, err, "branch not found")
		return
	}
	c.JSON(http.StatusOK, b)
}

type branchReq struct {
	Name         string               `json:"name" binding:"required"`
	Slug         string               `json:"slug"`
	Phone        string               `json:"phone"`
	Email        string               `json:"email"`
	Line1        string               `json:"line1"`
	Line2        string               `json:"line2"`
	City         string               `json:"city"`
	State        string               `json:"state"`
	PostalCode   string               `json:"postal_code"`
	Country      string               `json:"country"`
	CenterLat    float64              `json:"center_lat"`
	CenterLng    float64              `json:"center_lng"`
	RadiusKm     float64              `json:"radius_km"`
	ServiceZones []models.ServiceZone `json:"service_zones"`
	Areas        []string             `json:"areas"`
	IsActive     bool                 `json:"is_active"`
	IsDefault    bool                 `json:"is_default"`
	SortOrder    int                  `json:"sort_order"`
}

func (h *BranchHandler) Create(c *gin.Context) {
	tid := tenantID(c)
	var req branchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	slug := req.Slug
	if slug == "" {
		slug = slugify(req.Name)
	}
	if slug == "" {
		errResponse(c, http.StatusBadRequest, "branch slug could not be derived")
		return
	}
	b := &models.Branch{
		TenantID: tid, Name: req.Name, Slug: slug, Phone: req.Phone, Email: req.Email,
		Line1: req.Line1, Line2: req.Line2, City: req.City, State: req.State,
		PostalCode: req.PostalCode, Country: req.Country,
		CenterLat: req.CenterLat, CenterLng: req.CenterLng, RadiusKm: req.RadiusKm,
		ServiceZones: req.ServiceZones,
		Areas:        req.Areas, IsActive: req.IsActive, IsDefault: req.IsDefault, SortOrder: req.SortOrder,
	}
	if err := h.store.CreateBranch(c.Request.Context(), b); err != nil {
		errResponse(c, http.StatusConflict, err.Error())
		return
	}
	// Ensure a single default: creating with is_default=true clears the others.
	if b.IsDefault {
		_ = h.store.SetDefaultBranch(c.Request.Context(), tid, b.ID)
	}
	c.JSON(http.StatusCreated, b)
}

func (h *BranchHandler) Update(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req branchReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	slug := req.Slug
	if slug == "" {
		slug = slugify(req.Name)
	}
	b := &models.Branch{
		ID: id, TenantID: tid, Name: req.Name, Slug: slug, Phone: req.Phone, Email: req.Email,
		Line1: req.Line1, Line2: req.Line2, City: req.City, State: req.State,
		PostalCode: req.PostalCode, Country: req.Country,
		CenterLat: req.CenterLat, CenterLng: req.CenterLng, RadiusKm: req.RadiusKm,
		ServiceZones: req.ServiceZones,
		Areas:        req.Areas, IsActive: req.IsActive, IsDefault: req.IsDefault, SortOrder: req.SortOrder,
	}
	if err := h.store.UpdateBranch(c.Request.Context(), b); err != nil {
		notFoundOrErr(c, err, "branch not found")
		return
	}
	if b.IsDefault {
		_ = h.store.SetDefaultBranch(c.Request.Context(), tid, b.ID)
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *BranchHandler) Delete(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteBranch(c.Request.Context(), tenantID(c), id); err != nil {
		notFoundOrErr(c, err, "branch not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *BranchHandler) SetDefault(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if err := h.store.SetDefaultBranch(c.Request.Context(), tenantID(c), id); err != nil {
		notFoundOrErr(c, err, "branch not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}
