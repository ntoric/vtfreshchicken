package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type PaymentsHandler struct {
	store PaymentsStore
}

type PaymentsStore interface {
	ListPaymentTransactions(ctx context.Context, tenantID uuid.UUID, limit, offset int, status, gateway string) ([]models.PaymentTransaction, int, error)
	ListPaymentTransactionsFiltered(ctx context.Context, tenantID uuid.UUID, f services.PaymentTxnFilter, limit, offset int) ([]models.PaymentTransaction, int, error)
	GetPaymentTransaction(ctx context.Context, tenantID, txnID uuid.UUID) (*models.PaymentTransaction, error)
	ListOrderPaymentTransactions(ctx context.Context, tenantID, orderID uuid.UUID) ([]models.PaymentTransaction, error)
	RecordPaymentTransaction(ctx context.Context, pt *models.PaymentTransaction) error
	RefundPaymentTransaction(ctx context.Context, tenantID, txnID uuid.UUID, req *models.RefundRequest) (*models.PaymentTransaction, error)

	ListPaymentGatewayConfigs(ctx context.Context, tenantID uuid.UUID) ([]models.PaymentGatewayConfig, error)
	UpdatePaymentGatewayConfig(ctx context.Context, pgc *models.PaymentGatewayConfig) error
	EnsureDefaultGatewayConfigs(ctx context.Context, tenantID uuid.UUID) error

	PaymentStats(ctx context.Context, tenantID uuid.UUID, dr services.DateRangeFilter, branchID *uuid.UUID) (*models.PaymentStats, error)

	// Branch-scoping helpers used to gate branch-bound staff.
	PaymentTxnInBranch(ctx context.Context, tenantID, txnID, branchID uuid.UUID) (bool, error)
	OrderInBranch(ctx context.Context, tenantID, orderID, branchID uuid.UUID) (bool, error)
}

func NewPaymentsHandler(s PaymentsStore) *PaymentsHandler {
	return &PaymentsHandler{store: s}
}

// ---------------- Payment Transactions ----------------

func (h *PaymentsHandler) ListTransactions(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	f := services.PaymentTxnFilter{
		Status:   c.Query("status"),
		Gateway:  c.Query("gateway"),
		Type:     c.Query("type"),
		Search:   c.Query("search"),
		BranchID: branchFilter(c),
		Dr:       services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")},
	}

	items, total, err := h.store.ListPaymentTransactionsFiltered(c.Request.Context(), tid, f, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// txnBranchAllowed reports whether a branch-bound caller may access the
// transaction — they can only reach transactions on their branch's orders.
func (h *PaymentsHandler) txnBranchAllowed(c *gin.Context, txnID uuid.UUID) bool {
	if !branchRestricted(c) {
		return true
	}
	scope := branchFilter(c)
	if scope == nil {
		return true
	}
	allowed, err := h.store.PaymentTxnInBranch(c.Request.Context(), tenantID(c), txnID, *scope)
	return err == nil && allowed
}

// orderBranchAllowed reports whether a branch-bound caller may access records
// attached to the given order.
func (h *PaymentsHandler) orderBranchAllowed(c *gin.Context, orderID uuid.UUID) bool {
	if !branchRestricted(c) {
		return true
	}
	scope := branchFilter(c)
	if scope == nil {
		return true
	}
	allowed, err := h.store.OrderInBranch(c.Request.Context(), tenantID(c), orderID, *scope)
	return err == nil && allowed
}

func (h *PaymentsHandler) GetTransaction(c *gin.Context) {
	txnID, err := uuid.Parse(c.Param("txnId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid transaction id")
		return
	}
	if !h.txnBranchAllowed(c, txnID) {
		errResponse(c, http.StatusNotFound, "payment transaction not found")
		return
	}
	pt, err := h.store.GetPaymentTransaction(c.Request.Context(), tenantID(c), txnID)
	if err != nil {
		notFoundOrErr(c, err, "payment transaction not found")
		return
	}
	c.JSON(http.StatusOK, pt)
}

func (h *PaymentsHandler) ListOrderTransactions(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid order id")
		return
	}
	if !h.orderBranchAllowed(c, orderID) {
		errResponse(c, http.StatusNotFound, "order not found")
		return
	}
	items, err := h.store.ListOrderPaymentTransactions(c.Request.Context(), tenantID(c), orderID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// RefundTransaction processes a full or partial refund for a payment transaction.
func (h *PaymentsHandler) RefundTransaction(c *gin.Context) {
	txnID, err := uuid.Parse(c.Param("txnId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid transaction id")
		return
	}
	if !h.txnBranchAllowed(c, txnID) {
		errResponse(c, http.StatusNotFound, "payment transaction not found")
		return
	}
	var req models.RefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.store.RefundPaymentTransaction(c.Request.Context(), tenantID(c), txnID, &req)
	if err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ---------------- Payment Gateway Configs ----------------

func (h *PaymentsHandler) ListGatewayConfigs(c *gin.Context) {
	// Backfill rows for stores created after the payments module was seeded,
	// so the admin/developer UI always has a config row per built-in gateway.
	_ = h.store.EnsureDefaultGatewayConfigs(c.Request.Context(), tenantID(c))
	configs, err := h.store.ListPaymentGatewayConfigs(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": configs})
}

func (h *PaymentsHandler) UpdateGatewayConfig(c *gin.Context) {
	configID, err := uuid.Parse(c.Param("configId"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid config id")
		return
	}
	var pgc models.PaymentGatewayConfig
	if err := c.ShouldBindJSON(&pgc); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	pgc.ID = configID
	pgc.TenantID = tenantID(c)
	if pgc.DisplayName == "" {
		errResponse(c, http.StatusBadRequest, "display_name is required")
		return
	}
	if err := h.store.UpdatePaymentGatewayConfig(c.Request.Context(), &pgc); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, pgc)
}

// ---------------- Payment Stats ----------------

func (h *PaymentsHandler) Stats(c *gin.Context) {
	dr := services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")}
	stats, err := h.store.PaymentStats(c.Request.Context(), tenantID(c), dr, branchFilter(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}
