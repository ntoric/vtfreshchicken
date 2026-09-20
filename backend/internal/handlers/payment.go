package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/payment"
)

// PaymentHandler exposes available payment methods and is the bridge
// between the frontend and the payment gateway registry.
type PaymentHandler struct {
	registry *payment.Registry
}

func NewPaymentHandler(registry *payment.Registry) *PaymentHandler {
	return &PaymentHandler{registry: registry}
}

// ListMethods returns all active payment gateways.
// The frontend uses this to render the gateway selector on the payment page.
func (h *PaymentHandler) ListMethods(c *gin.Context) {
	methods := h.registry.List()
	if methods == nil {
		methods = []payment.GatewayInfo{}
	}
	c.JSON(http.StatusOK, gin.H{
		"methods":   methods,
		"total":     len(methods),
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

	result, err := creator.CreateOrder(c.Request.Context(), payment.CreateOrderRequest{
		Amount:        req.Amount,
		Currency:      req.Currency,
		Receipt:       req.Receipt,
		CustomerName:  req.CustomerName,
		CustomerEmail: req.CustomerEmail,
	})
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "order creation failed: "+err.Error())
		return
	}

	c.JSON(http.StatusOK, result)
}
