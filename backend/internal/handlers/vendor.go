package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type VendorHandler struct {
	store *services.Store
}

func NewVendorHandler(store *services.Store) *VendorHandler {
	return &VendorHandler{store: store}
}

type vendorReq struct {
	Name           string  `json:"name" binding:"required"`
	Slug           string  `json:"slug" binding:"required"`
	Email          string  `json:"email"`
	Phone          string  `json:"phone"`
	Address        string  `json:"address"`
	ContactPerson  string  `json:"contact_person"`
	CommissionRate float64 `json:"commission_rate"`
	Status         string  `json:"status"`
	Notes          string  `json:"notes"`
}

func (h *VendorHandler) List(c *gin.Context) {
	vendors, err := h.store.ListVendors(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": vendors})
}

func (h *VendorHandler) Get(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	v, err := h.store.GetVendor(c.Request.Context(), tenantID(c), id)
	if err != nil {
		notFoundOrErr(c, err, "vendor not found")
		return
	}
	c.JSON(http.StatusOK, v)
}

func (h *VendorHandler) Create(c *gin.Context) {
	tid := tenantID(c)
	var req vendorReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Status == "" {
		req.Status = "active"
	}
	v := &models.Vendor{
		TenantID:       tid,
		Name:           req.Name,
		Slug:           req.Slug,
		Email:          req.Email,
		Phone:          req.Phone,
		Address:        req.Address,
		ContactPerson:  req.ContactPerson,
		CommissionRate: req.CommissionRate,
		Status:         req.Status,
		Notes:          req.Notes,
	}
	created, err := h.store.CreateVendor(c.Request.Context(), v)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			errResponse(c, http.StatusConflict, "vendor slug already exists")
		} else {
			errResponse(c, http.StatusInternalServerError, err.Error())
		}
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *VendorHandler) Update(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req vendorReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Status == "" {
		req.Status = "active"
	}
	v := &models.Vendor{
		ID:             id,
		TenantID:       tid,
		Name:           req.Name,
		Slug:           req.Slug,
		Email:          req.Email,
		Phone:          req.Phone,
		Address:        req.Address,
		ContactPerson:  req.ContactPerson,
		CommissionRate: req.CommissionRate,
		Status:         req.Status,
		Notes:          req.Notes,
	}
	updated, err := h.store.UpdateVendor(c.Request.Context(), v)
	if err != nil {
		notFoundOrErr(c, err, "vendor not found")
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *VendorHandler) Delete(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteVendor(c.Request.Context(), tenantID(c), id); err != nil {
		notFoundOrErr(c, err, "vendor not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// slugify converts a name to a URL-safe slug.
func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "/", "-")
	return s
}
