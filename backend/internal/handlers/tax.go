package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
)

type TaxHandler struct {
	store TaxStore
}

type TaxStore interface {
	ListTaxClasses(ctx context.Context, tenantID uuid.UUID) ([]models.TaxClass, error)
	GetTaxClass(ctx context.Context, tenantID, classID uuid.UUID) (*models.TaxClass, error)
	CreateTaxClass(ctx context.Context, tc *models.TaxClass) error
	UpdateTaxClass(ctx context.Context, tc *models.TaxClass) error
	DeleteTaxClass(ctx context.Context, tenantID, classID uuid.UUID) error

	ListTaxZones(ctx context.Context, tenantID uuid.UUID) ([]models.TaxZone, error)
	CreateTaxZone(ctx context.Context, tz *models.TaxZone) error
	UpdateTaxZone(ctx context.Context, tz *models.TaxZone) error
	DeleteTaxZone(ctx context.Context, tenantID, zoneID uuid.UUID) error

	ListTaxRates(ctx context.Context, tenantID uuid.UUID) ([]models.TaxRate, error)
	CreateTaxRate(ctx context.Context, tr *models.TaxRate) error
	UpdateTaxRate(ctx context.Context, tr *models.TaxRate) error
	DeleteTaxRate(ctx context.Context, tenantID, rateID uuid.UUID) error

	GetDefaultTaxClass(ctx context.Context, tenantID uuid.UUID) (*models.TaxClass, error)

	CalculateTax(ctx context.Context, tenantID uuid.UUID, req *models.TaxCalculationRequest, settings *models.TenantSettings) (*models.TaxCalculationResult, error)
	GetTenantSettings(ctx context.Context, tenantID uuid.UUID) (*models.TenantSettings, error)
}

func NewTaxHandler(s TaxStore) *TaxHandler {
	return &TaxHandler{store: s}
}

// CalculateTax is a public endpoint that computes tax for a given cart + shipping address.
// Used by the frontstore checkout to display accurate tax before payment.
func (h *TaxHandler) CalculateTax(c *gin.Context) {
	var req models.TaxCalculationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ShippingAddress.Country == "" {
		errResponse(c, http.StatusBadRequest, "shipping_address.country is required")
		return
	}
	tid := tenantID(c)
	settings, err := h.store.GetTenantSettings(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to load tenant settings")
		return
	}
	result, err := h.store.CalculateTax(c.Request.Context(), tid, &req, settings)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, result)
}

// ---------------- Tax Classes ----------------

func (h *TaxHandler) ListTaxClasses(c *gin.Context) {
	classes, err := h.store.ListTaxClasses(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": classes})
}

func (h *TaxHandler) CreateTaxClass(c *gin.Context) {
	var tc models.TaxClass
	if err := c.ShouldBindJSON(&tc); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	tc.TenantID = tenantID(c)
	if tc.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.store.CreateTaxClass(c.Request.Context(), &tc); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, tc)
}

func (h *TaxHandler) UpdateTaxClass(c *gin.Context) {
	classID, err := uuid.Parse(c.Param("classId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid class id")
		return
	}
	var tc models.TaxClass
	if err := c.ShouldBindJSON(&tc); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	tc.ID = classID
	tc.TenantID = tenantID(c)
	if tc.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.store.UpdateTaxClass(c.Request.Context(), &tc); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, tc)
}

func (h *TaxHandler) DeleteTaxClass(c *gin.Context) {
	classID, err := uuid.Parse(c.Param("classId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid class id")
		return
	}
	if err := h.store.DeleteTaxClass(c.Request.Context(), tenantID(c), classID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ---------------- Tax Zones ----------------

func (h *TaxHandler) ListTaxZones(c *gin.Context) {
	zones, err := h.store.ListTaxZones(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": zones})
}

func (h *TaxHandler) CreateTaxZone(c *gin.Context) {
	var tz models.TaxZone
	if err := c.ShouldBindJSON(&tz); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	tz.TenantID = tenantID(c)
	if tz.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.store.CreateTaxZone(c.Request.Context(), &tz); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, tz)
}

func (h *TaxHandler) UpdateTaxZone(c *gin.Context) {
	zoneID, err := uuid.Parse(c.Param("zoneId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid zone id")
		return
	}
	var tz models.TaxZone
	if err := c.ShouldBindJSON(&tz); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	tz.ID = zoneID
	tz.TenantID = tenantID(c)
	if tz.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.store.UpdateTaxZone(c.Request.Context(), &tz); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, tz)
}

func (h *TaxHandler) DeleteTaxZone(c *gin.Context) {
	zoneID, err := uuid.Parse(c.Param("zoneId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid zone id")
		return
	}
	if err := h.store.DeleteTaxZone(c.Request.Context(), tenantID(c), zoneID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ---------------- Tax Rates ----------------

func (h *TaxHandler) ListTaxRates(c *gin.Context) {
	rates, err := h.store.ListTaxRates(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": rates})
}

func (h *TaxHandler) CreateTaxRate(c *gin.Context) {
	var tr models.TaxRate
	if err := c.ShouldBindJSON(&tr); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	tr.TenantID = tenantID(c)
	if tr.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if tr.TaxClassID == uuid.Nil {
		errResponse(c, http.StatusBadRequest, "tax_class_id is required")
		return
	}
	if tr.TaxZoneID == uuid.Nil {
		errResponse(c, http.StatusBadRequest, "tax_zone_id is required")
		return
	}
	if err := h.store.CreateTaxRate(c.Request.Context(), &tr); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, tr)
}

func (h *TaxHandler) UpdateTaxRate(c *gin.Context) {
	rateID, err := uuid.Parse(c.Param("rateId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid rate id")
		return
	}
	var tr models.TaxRate
	if err := c.ShouldBindJSON(&tr); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	tr.ID = rateID
	tr.TenantID = tenantID(c)
	if tr.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.store.UpdateTaxRate(c.Request.Context(), &tr); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, tr)
}

func (h *TaxHandler) DeleteTaxRate(c *gin.Context) {
	rateID, err := uuid.Parse(c.Param("rateId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid rate id")
		return
	}
	if err := h.store.DeleteTaxRate(c.Request.Context(), tenantID(c), rateID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
