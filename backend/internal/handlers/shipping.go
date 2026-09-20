package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
)

type ShippingHandler struct {
	store ShippingStore
}

type ShippingStore interface {
	ListShippingMethods(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingMethod, error)
	ListActiveShippingMethods(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingMethod, error)
	GetShippingMethod(ctx context.Context, tenantID, methodID uuid.UUID) (*models.ShippingMethod, error)
	GetShippingMethodByCode(ctx context.Context, tenantID uuid.UUID, code string) (*models.ShippingMethod, error)
	CreateShippingMethod(ctx context.Context, sm *models.ShippingMethod) error
	UpdateShippingMethod(ctx context.Context, sm *models.ShippingMethod) error
	DeleteShippingMethod(ctx context.Context, tenantID, methodID uuid.UUID) error

	ListShippingZones(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingZone, error)
	CreateShippingZone(ctx context.Context, sz *models.ShippingZone) error
	UpdateShippingZone(ctx context.Context, sz *models.ShippingZone) error
	DeleteShippingZone(ctx context.Context, tenantID, zoneID uuid.UUID) error

	ListShippingRates(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingRate, error)
	CreateShippingRate(ctx context.Context, sr *models.ShippingRate) error
	UpdateShippingRate(ctx context.Context, sr *models.ShippingRate) error
	DeleteShippingRate(ctx context.Context, tenantID, rateID uuid.UUID) error

	CalculateShipping(ctx context.Context, tenantID uuid.UUID, req *models.ShippingCalculationRequest) (*models.ShippingCalculationResult, error)
	ResolveShippingRate(ctx context.Context, tenantID uuid.UUID, methodCode string, subtotal float64, addr models.AddressInput, items []models.ShippingCalculationItem) (float64, error)
}

func NewShippingHandler(s ShippingStore) *ShippingHandler {
	return &ShippingHandler{store: s}
}

// CalculateShipping is a public endpoint that returns available shipping options.
// Used by the frontstore checkout to display shipping methods and rates.
func (h *ShippingHandler) CalculateShipping(c *gin.Context) {
	var req models.ShippingCalculationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ShippingAddress.Country == "" {
		errResponse(c, http.StatusBadRequest, "shipping_address.country is required")
		return
	}
	result, err := h.store.CalculateShipping(c.Request.Context(), tenantID(c), &req)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, result)
}

// ---------------- Shipping Methods ----------------

func (h *ShippingHandler) ListShippingMethods(c *gin.Context) {
	methods, err := h.store.ListShippingMethods(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": methods})
}

func (h *ShippingHandler) CreateShippingMethod(c *gin.Context) {
	var sm models.ShippingMethod
	if err := c.ShouldBindJSON(&sm); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	sm.TenantID = tenantID(c)
	if sm.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if sm.Code == "" {
		errResponse(c, http.StatusBadRequest, "code is required")
		return
	}
	if sm.CurrencyCode == "" {
		sm.CurrencyCode = "USD"
	}
	if err := h.store.CreateShippingMethod(c.Request.Context(), &sm); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, sm)
}

func (h *ShippingHandler) UpdateShippingMethod(c *gin.Context) {
	methodID, err := uuid.Parse(c.Param("methodId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid method id")
		return
	}
	var sm models.ShippingMethod
	if err := c.ShouldBindJSON(&sm); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	sm.ID = methodID
	sm.TenantID = tenantID(c)
	if sm.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if sm.Code == "" {
		errResponse(c, http.StatusBadRequest, "code is required")
		return
	}
	if err := h.store.UpdateShippingMethod(c.Request.Context(), &sm); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, sm)
}

func (h *ShippingHandler) DeleteShippingMethod(c *gin.Context) {
	methodID, err := uuid.Parse(c.Param("methodId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid method id")
		return
	}
	if err := h.store.DeleteShippingMethod(c.Request.Context(), tenantID(c), methodID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ---------------- Shipping Zones ----------------

func (h *ShippingHandler) ListShippingZones(c *gin.Context) {
	zones, err := h.store.ListShippingZones(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": zones})
}

func (h *ShippingHandler) CreateShippingZone(c *gin.Context) {
	var sz models.ShippingZone
	if err := c.ShouldBindJSON(&sz); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	sz.TenantID = tenantID(c)
	if sz.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.store.CreateShippingZone(c.Request.Context(), &sz); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, sz)
}

func (h *ShippingHandler) UpdateShippingZone(c *gin.Context) {
	zoneID, err := uuid.Parse(c.Param("zoneId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid zone id")
		return
	}
	var sz models.ShippingZone
	if err := c.ShouldBindJSON(&sz); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	sz.ID = zoneID
	sz.TenantID = tenantID(c)
	if sz.Name == "" {
		errResponse(c, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.store.UpdateShippingZone(c.Request.Context(), &sz); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, sz)
}

func (h *ShippingHandler) DeleteShippingZone(c *gin.Context) {
	zoneID, err := uuid.Parse(c.Param("zoneId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid zone id")
		return
	}
	if err := h.store.DeleteShippingZone(c.Request.Context(), tenantID(c), zoneID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ---------------- Shipping Rates ----------------

func (h *ShippingHandler) ListShippingRates(c *gin.Context) {
	rates, err := h.store.ListShippingRates(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": rates})
}

func (h *ShippingHandler) CreateShippingRate(c *gin.Context) {
	var sr models.ShippingRate
	if err := c.ShouldBindJSON(&sr); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	sr.TenantID = tenantID(c)
	if sr.ShippingMethodID == uuid.Nil {
		errResponse(c, http.StatusBadRequest, "shipping_method_id is required")
		return
	}
	if sr.ShippingZoneID == uuid.Nil {
		errResponse(c, http.StatusBadRequest, "shipping_zone_id is required")
		return
	}
	if err := h.store.CreateShippingRate(c.Request.Context(), &sr); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, sr)
}

func (h *ShippingHandler) UpdateShippingRate(c *gin.Context) {
	rateID, err := uuid.Parse(c.Param("rateId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid rate id")
		return
	}
	var sr models.ShippingRate
	if err := c.ShouldBindJSON(&sr); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	sr.ID = rateID
	sr.TenantID = tenantID(c)
	if sr.ShippingMethodID == uuid.Nil {
		errResponse(c, http.StatusBadRequest, "shipping_method_id is required")
		return
	}
	if sr.ShippingZoneID == uuid.Nil {
		errResponse(c, http.StatusBadRequest, "shipping_zone_id is required")
		return
	}
	if err := h.store.UpdateShippingRate(c.Request.Context(), &sr); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, sr)
}

func (h *ShippingHandler) DeleteShippingRate(c *gin.Context) {
	rateID, err := uuid.Parse(c.Param("rateId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid rate id")
		return
	}
	if err := h.store.DeleteShippingRate(c.Request.Context(), tenantID(c), rateID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
