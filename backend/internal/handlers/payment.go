package handlers

import (
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/payment"
	"github.com/trucommerce/backend/internal/services"
)

// PaymentHandler exposes available payment methods and is the bridge
// between the frontend and the payment gateway registry.
type PaymentHandler struct {
	registry *payment.Registry
	store    *services.Store
}

func NewPaymentHandler(registry *payment.Registry, store *services.Store) *PaymentHandler {
	return &PaymentHandler{registry: registry, store: store}
}

// gatewayPublicConfigKeys lists the per-gateway config keys that are safe to
// expose to the storefront via public_config. Secrets are never listed here;
// secret-looking keys are masked in admin API responses.
var gatewayPublicConfigKeys = map[string][]string{
	"razorpay": {"key_id"},
	"paypal":   {"client_id"},
}

// ListMethods returns all active payment gateways, merged with the store's
// gateway configuration: disabled gateways are hidden, and the store's
// display name, sort order, test-mode flag, and public config (e.g. Razorpay
// key_id) are applied on top of the registry defaults.
func (h *PaymentHandler) ListMethods(c *gin.Context) {
	methods := h.registry.List()
	if methods == nil {
		methods = []payment.GatewayInfo{}
	}

	cfgs, err := h.store.GatewayConfigMap(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	out := make([]payment.GatewayInfo, 0, len(methods))
	for _, info := range methods {
		cfg, ok := cfgs[info.ID]
		if !ok {
			// No config row (e.g. the built-in "wallet" method) — registry
			// defaults apply.
			out = append(out, info)
			continue
		}
		if !cfg.IsEnabled {
			continue
		}
		if cfg.DisplayName != "" {
			info.Name = cfg.DisplayName
		}
		info.SortOrder = cfg.SortOrder
		if info.PublicConfig == nil {
			info.PublicConfig = map[string]interface{}{}
		}
		info.PublicConfig["test_mode"] = cfg.IsTestMode
		for _, k := range gatewayPublicConfigKeys[info.ID] {
			if v, ok := cfg.Config[k].(string); ok && v != "" {
				info.PublicConfig[k] = v
				delete(info.PublicConfig, "demo_mode")
			}
		}
		out = append(out, info)
	}

	// Re-sort by the store's configured sort order (stable — preserves
	// registry order for ties).
	sort.SliceStable(out, func(i, j int) bool { return out[i].SortOrder < out[j].SortOrder })

	c.JSON(http.StatusOK, gin.H{
		"methods":   out,
		"total":     len(out),
		"test_mode": payment.IsTestMode(),
	})
}

// ListTestCards returns all available test cards for development testing.
// Only available in test mode.
func (h *PaymentHandler) ListTestCards(c *gin.Context) {
	if !payment.IsTestMode() {
		errResponse(c, http.StatusForbidden, "test mode is not active")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"cards": payment.TestCards,
		"total": len(payment.TestCards),
	})
}

// ListTestTransactions returns the in-memory test transaction log.
// Only available in test mode.
func (h *PaymentHandler) ListTestTransactions(c *gin.Context) {
	if !payment.IsTestMode() {
		errResponse(c, http.StatusForbidden, "test mode is not active")
		return
	}
	txs := payment.ListTestTransactions()
	if txs == nil {
		txs = []payment.TestTransaction{}
	}
	c.JSON(http.StatusOK, gin.H{
		"transactions": txs,
		"total":        len(txs),
	})
}

// ClearTestTransactions clears the in-memory test transaction log.
// Only available in test mode.
func (h *PaymentHandler) ClearTestTransactions(c *gin.Context) {
	if !payment.IsTestMode() {
		errResponse(c, http.StatusForbidden, "test mode is not active")
		return
	}
	payment.ClearTestTransactions()
	c.JSON(http.StatusOK, gin.H{"message": "test transactions cleared"})
}

// CreateOrder is a generic endpoint for gateways that need server-side order
// creation before the frontend can open the checkout flow (e.g. Razorpay).
// The gateway is looked up by :gatewayId from the registry. If the gateway
// implements the OrderCreator interface, CreateOrder is called.
type createOrderReq struct {
	Amount       float64 `json:"amount" binding:"required"`
	Currency     string  `json:"currency"`
	Receipt      string  `json:"receipt"`
	CustomerName string  `json:"customer_name"`
	CustomerEmail string `json:"customer_email"`
}

func (h *PaymentHandler) CreateOrder(c *gin.Context) {
	gatewayID := c.Param("gatewayId")
	gateway, ok := h.registry.Get(gatewayID)
	if !ok {
		errResponse(c, http.StatusBadRequest, "unknown payment gateway: "+gatewayID)
		return
	}

	var gwCfg *models.PaymentGatewayConfig
	gwCfg, err := h.store.GetPaymentGatewayConfig(c.Request.Context(), tenantID(c), gatewayID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if gwCfg != nil && !gwCfg.IsEnabled {
		errResponse(c, http.StatusBadRequest, "payment method is disabled")
		return
	}

	creator, ok := gateway.(payment.OrderCreator)
	if !ok {
		errResponse(c, http.StatusBadRequest, "gateway "+gatewayID+" does not support order creation")
		return
	}

	var req createOrderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	if req.Currency == "" {
		req.Currency = "USD"
	}

	var cfg map[string]interface{}
	if gwCfg != nil {
		cfg = gwCfg.Config
	}
	result, err := creator.CreateOrder(c.Request.Context(), payment.CreateOrderRequest{
		Amount:        req.Amount,
		Currency:      req.Currency,
		Receipt:       req.Receipt,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
		Config:        cfg,
	})
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "order creation failed: "+err.Error())
		return
	}

	c.JSON(http.StatusOK, result)
}
