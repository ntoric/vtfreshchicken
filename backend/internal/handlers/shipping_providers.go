package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
)

// ShippingProviderStore defines the store interface for shipping provider operations.
type ShippingProviderStore interface {
	ListShippingProviders(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingProvider, error)
	GetShippingProvider(ctx context.Context, tenantID, id uuid.UUID) (*models.ShippingProvider, error)
	GetShippingProviderByCode(ctx context.Context, tenantID uuid.UUID, code string) (*models.ShippingProvider, error)
	CreateShippingProvider(ctx context.Context, p *models.ShippingProvider) error
	UpdateShippingProvider(ctx context.Context, p *models.ShippingProvider) error
	DeleteShippingProvider(ctx context.Context, tenantID, id uuid.UUID) error

	ListOrderShipments(ctx context.Context, tenantID, orderID uuid.UUID) ([]models.Shipment, error)
	GetShipment(ctx context.Context, tenantID, id uuid.UUID) (*models.Shipment, error)
	CreateOrderShipment(ctx context.Context, tenantID, orderID uuid.UUID, providerCode string, estimatedDelivery *time.Time) (*models.Shipment, error)
	CreateOrderShipmentWithItems(ctx context.Context, tenantID, orderID uuid.UUID, providerCode string, itemIDs []uuid.UUID, itemQuantities []models.ShipmentItemQuantity, estimatedDelivery *time.Time) (*models.Shipment, error)
	TrackShipment(ctx context.Context, tenantID, shipmentID uuid.UUID) (*models.TrackingResponse, error)
	TestShippingProvider(ctx context.Context, tenantID, id uuid.UUID) (*models.ProviderTestResult, error)
}

type ShippingProviderHandler struct {
	store ShippingProviderStore
}

func NewShippingProviderHandler(s ShippingProviderStore) *ShippingProviderHandler {
	return &ShippingProviderHandler{store: s}
}

// ---- Provider CRUD ----

func (h *ShippingProviderHandler) ListProviders(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	providers, err := h.store.ListShippingProviders(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": providers})
}

func (h *ShippingProviderHandler) CreateProvider(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	var p models.ShippingProvider
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.TenantID = tenantID
	if p.ProviderCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider_code is required"})
		return
	}
	// Validate provider code is supported
	supported := false
	for _, code := range models.SupportedShippingProviders {
		if code == p.ProviderCode {
			supported = true
			break
		}
	}
	if !supported {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported provider code: " + p.ProviderCode})
		return
	}
	if p.DisplayName == "" {
		p.DisplayName = p.ProviderCode
	}
	if err := h.store.CreateShippingProvider(c.Request.Context(), &p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *ShippingProviderHandler) UpdateProvider(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var p models.ShippingProvider
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p.ID = id
	p.TenantID = tenantID
	if err := h.store.UpdateShippingProvider(c.Request.Context(), &p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *ShippingProviderHandler) DeleteProvider(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.store.DeleteShippingProvider(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// ---- Test connection ----

func (h *ShippingProviderHandler) TestProvider(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	provider, err := h.store.GetShippingProvider(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "provider not found"})
		return
	}
	result, err := h.store.TestShippingProvider(c.Request.Context(), tenantID, provider.ID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// ---- Shipments ----

func (h *ShippingProviderHandler) ListOrderShipments(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	shipments, err := h.store.ListOrderShipments(c.Request.Context(), tenantID, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": shipments})
}

func (h *ShippingProviderHandler) CreateOrderShipment(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid order id"})
		return
	}
	var req models.ShipmentCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body — use default "delhivery" if configured
		req.ProviderCode = "delhivery"
	}
	if req.ProviderCode == "" {
		req.ProviderCode = "delhivery"
	}
	// Parse the optional estimated delivery date. Accepts a date-only
	// ("2026-09-15") or a full RFC 3339 datetime. Empty/unset = nil.
	estimatedDelivery := parseEstimatedDelivery(req.EstimatedDelivery)
	// Split-shipment support: when item_ids are provided, create a shipment for
	// only those order items. Otherwise, create a whole-order shipment (legacy).
	var shipment *models.Shipment
	if len(req.ItemIDs) > 0 {
		shipment, err = h.store.CreateOrderShipmentWithItems(c.Request.Context(), tenantID, orderID, req.ProviderCode, req.ItemIDs, req.ItemQuantities, estimatedDelivery)
	} else {
		shipment, err = h.store.CreateOrderShipment(c.Request.Context(), tenantID, orderID, req.ProviderCode, estimatedDelivery)
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"shipment": shipment})
}

// parseEstimatedDelivery parses an optional estimated delivery date string.
// Accepts a date-only ("2026-09-15") or a full RFC 3339 datetime. Returns nil
// for empty/unparseable input.
func parseEstimatedDelivery(s *string) *time.Time {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	val := strings.TrimSpace(*s)
	// Try full RFC 3339 first (e.g. "2026-09-15T00:00:00Z").
	if t, err := time.Parse(time.RFC3339, val); err == nil {
		return &t
	}
	// Fall back to date-only.
	if t, err := time.Parse("2006-01-02", val); err == nil {
		return &t
	}
	return nil
}

func (h *ShippingProviderHandler) TrackShipment(c *gin.Context) {
	tenantID := c.MustGet("tenant_id").(uuid.UUID)
	shipmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shipment id"})
		return
	}
	tracking, err := h.store.TrackShipment(c.Request.Context(), tenantID, shipmentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tracking)
}
