package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/middleware"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/payment"
	"github.com/trucommerce/backend/internal/services"
)

// WalletHandler handles customer-facing wallet endpoints (balance, top-up,
// transactions) and admin-facing wallet management (view, adjust, list).
type WalletHandler struct {
	store    *services.Store
	registry *payment.Registry
}

func NewWalletHandler(store *services.Store, registry *payment.Registry) *WalletHandler {
	return &WalletHandler{store: store, registry: registry}
}

// GetWallet returns the authenticated customer's wallet (creating it on first access).
func (h *WalletHandler) GetWallet(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)

	w, err := h.store.GetOrCreateWallet(c.Request.Context(), tid, uid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, w)
}

// TopUp processes a payment via the selected gateway and credits the wallet on success.
func (h *WalletHandler) TopUp(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)

	var req models.WalletTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid top-up request: "+err.Error())
		return
	}
	if req.Amount <= 0 {
		errResponse(c, http.StatusBadRequest, "amount must be greater than 0")
		return
	}
	if req.PaymentMethod == "" || req.PaymentMethod == "wallet" {
		errResponse(c, http.StatusBadRequest, "a non-wallet payment method is required to top up")
		return
	}

	currency := req.CurrencyCode
	if currency == "" {
		currency = "USD"
	}

	// Look up the payment gateway
	gateway, ok := h.registry.Get(req.PaymentMethod)
	if !ok {
		errResponse(c, http.StatusBadRequest, "unsupported payment method: "+req.PaymentMethod)
		return
	}

	// Build payment details map
	detailsMap := buildPaymentDetailsMap(req.PaymentDetails)

	// Process the top-up payment
	payResult, err := gateway.ProcessPayment(c.Request.Context(), payment.PaymentRequest{
		Amount:        req.Amount,
		Currency:      currency,
		OrderRef:      fmt.Sprintf("wallet_topup_%s", uid.String()[:8]),
		CustomerName:  "",
		CustomerEmail:  userEmail(c),
		Details:       detailsMap,
	})
	if err != nil {
		errResponse(c, http.StatusPaymentRequired, "payment processing failed: "+err.Error())
		return
	}
	if !payResult.Success {
		c.JSON(http.StatusPaymentRequired, gin.H{
			"error":          payResult.Message,
			"payment_status": payResult.Status,
		})
		return
	}

	// Ensure wallet exists
	if _, err := h.store.GetOrCreateWallet(c.Request.Context(), tid, uid); err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to initialize wallet: "+err.Error())
		return
	}

	// Record the payment transaction (no order_id for top-ups)
	pt := &models.PaymentTransaction{
		TenantID:      tid,
		UserID:        &uid,
		Gateway:       req.PaymentMethod,
		GatewayTxnID:  payResult.TransactionID,
		Type:          "capture",
		Status:        "success",
		Amount:        req.Amount,
		CurrencyCode:  currency,
		GatewayResponse: map[string]interface{}{
			"message":   payResult.Message,
			"purpose":   "wallet_topup",
		},
	}
	if err := h.store.RecordPaymentTransaction(c.Request.Context(), pt); err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to record payment: "+err.Error())
		return
	}

	// Credit the wallet
	desc := fmt.Sprintf("Wallet top-up via %s", req.PaymentMethod)
	paymentTxnID := pt.ID
	wt, err := h.store.CreditWallet(c.Request.Context(), tid, uid, req.Amount, "topup", desc, payResult.TransactionID, &paymentTxnID, nil)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "payment succeeded but wallet credit failed: "+err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"wallet":         wt,
		"payment_txn_id": pt.ID,
		"transaction_id": payResult.TransactionID,
		"message":        "Wallet topped up successfully",
	})
}

// ListTransactions returns the authenticated customer's wallet transaction history (paginated).
func (h *WalletHandler) ListTransactions(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	txns, total, err := h.store.ListWalletTransactions(c.Request.Context(), tid, uid, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if txns == nil {
		txns = []models.WalletTransaction{}
	}
	c.JSON(http.StatusOK, gin.H{
		"items":  txns,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// --- Admin endpoints (business_admin + staff + superadmin) ---

// AdminGetWallet returns a customer's wallet (admin view).
func (h *WalletHandler) AdminGetWallet(c *gin.Context) {
	tid := tenantID(c)
	customerID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid user id")
		return
	}

	w, err := h.store.GetOrCreateWallet(c.Request.Context(), tid, customerID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, w)
}

// AdminListTransactions returns a customer's wallet transactions (admin view).
func (h *WalletHandler) AdminListTransactions(c *gin.Context) {
	tid := tenantID(c)
	customerID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid user id")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	txns, total, err := h.store.ListWalletTransactions(c.Request.Context(), tid, customerID, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if txns == nil {
		txns = []models.WalletTransaction{}
	}
	c.JSON(http.StatusOK, gin.H{
		"items":  txns,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// AdminAdjust credits (positive) or debits (negative) a customer's wallet.
func (h *WalletHandler) AdminAdjust(c *gin.Context) {
	tid := tenantID(c)
	customerID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid user id")
		return
	}

	var req models.WalletAdjustRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	if req.Amount == 0 {
		errResponse(c, http.StatusBadRequest, "amount must be non-zero")
		return
	}

	// Ensure wallet exists
	if _, err := h.store.GetOrCreateWallet(c.Request.Context(), tid, customerID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	desc := req.Description
	if desc == "" {
		if req.Amount > 0 {
			desc = "Admin credit"
		} else {
			desc = "Admin debit"
		}
	}

	var wt *models.WalletTransaction
	if req.Amount > 0 {
		wt, err = h.store.CreditWallet(c.Request.Context(), tid, customerID, req.Amount, "admin_adjustment", desc, "admin", nil, nil)
	} else {
		wt, err = h.store.DebitWallet(c.Request.Context(), tid, customerID, -req.Amount, "admin_adjustment", desc, "admin", nil)
	}
	if err != nil {
		if err == services.ErrInsufficientBalance {
			errResponse(c, http.StatusBadRequest, "insufficient wallet balance for debit")
			return
		}
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, wt)
}

// AdminListAllTransactions returns all wallet transactions in the tenant (admin view).
func (h *WalletHandler) AdminListAllTransactions(c *gin.Context) {
	tid := tenantID(c)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	f := services.WalletTxnFilter{
		Type:   c.Query("type"),
		Source: c.Query("source"),
		Search: c.Query("search"),
		Dr:     services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")},
	}

	txns, total, err := h.store.ListAllWalletTransactionsFiltered(c.Request.Context(), tid, f, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if txns == nil {
		txns = []models.WalletTransaction{}
	}
	c.JSON(http.StatusOK, gin.H{
		"items":  txns,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// AdminStats returns aggregate wallet stats for the tenant.
func (h *WalletHandler) AdminStats(c *gin.Context) {
	tid := tenantID(c)
	stats, err := h.store.WalletStats(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

// --- helpers ---

func buildPaymentDetailsMap(pd *models.PaymentDetails) map[string]interface{} {
	m := make(map[string]interface{})
	if pd == nil {
		return m
	}
	if pd.CardNumber != "" {
		m["card_number"] = pd.CardNumber
	}
	if pd.CardName != "" {
		m["card_name"] = pd.CardName
	}
	if pd.CardExpiry != "" {
		m["card_expiry"] = pd.CardExpiry
	}
	if pd.CardCVV != "" {
		m["card_cvv"] = pd.CardCVV
	}
	if pd.CardLast4 != "" {
		m["card_last4"] = pd.CardLast4
	}
	if pd.CardBrand != "" {
		m["card_brand"] = pd.CardBrand
	}
	if pd.PaypalEmail != "" {
		m["paypal_email"] = pd.PaypalEmail
	}
	if pd.RazorpayOrderID != "" {
		m["razorpay_order_id"] = pd.RazorpayOrderID
	}
	if pd.RazorpayPaymentID != "" {
		m["razorpay_payment_id"] = pd.RazorpayPaymentID
	}
	if pd.RazorpaySignature != "" {
		m["razorpay_signature"] = pd.RazorpaySignature
	}
	return m
}

func userEmail(c *gin.Context) string {
	if v, ok := c.Get(middleware.CtxUserEmail); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
