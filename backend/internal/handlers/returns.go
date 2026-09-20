package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// ReturnsHandler handles order return/replacement/refund endpoints.
type ReturnsHandler struct {
	store *services.Store
}

func NewReturnsHandler(store *services.Store) *ReturnsHandler {
	return &ReturnsHandler{store: store}
}

// ListReturns returns paginated returns with optional filters.
func (h *ReturnsHandler) ListReturns(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	f := services.ReturnListFilter{
		Status: c.Query("status"),
		Type:   c.Query("type"),
		Search: c.Query("search"),
		Dr:     services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")},
	}

	returns, total, err := h.store.ListOrderReturns(c.Request.Context(), tid, f, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": returns, "total": total, "limit": limit, "offset": offset})
}

// GetReturn returns a single return with its items.
func (h *ReturnsHandler) GetReturn(c *gin.Context) {
	tid := tenantID(c)
	rid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	ret, err := h.store.GetOrderReturn(c.Request.Context(), tid, rid)
	if err != nil {
		notFoundOrErr(c, err, "return not found")
		return
	}
	c.JSON(http.StatusOK, ret)
}

// ListOrderReturns returns all returns for a specific order.
func (h *ReturnsHandler) ListOrderReturns(c *gin.Context) {
	tid := tenantID(c)
	oid, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	returns, err := h.store.ListReturnsByOrder(c.Request.Context(), tid, oid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": returns})
}

// CreateReturn creates a new return/replacement/refund request for an order.
func (h *ReturnsHandler) CreateReturn(c *gin.Context) {
	tid := tenantID(c)
	oid, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}

	var req models.ReturnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	// Validate type
	switch req.Type {
	case models.ReturnTypeRefund, models.ReturnTypeReplacement, models.ReturnTypeExchange, "":
		// ok
	default:
		errResponse(c, http.StatusBadRequest, "invalid return type; must be 'refund', 'replacement', or 'exchange'")
		return
	}

	// Validate refund method
	switch req.RefundMethod {
	case "original", "wallet", "store_credit", "none", "":
		// ok
	default:
		errResponse(c, http.StatusBadRequest, "invalid refund method; must be 'original', 'wallet', 'store_credit', or 'none'")
		return
	}

	// Get admin user ID for audit
	actorID := userID(c)
	ret := &models.OrderReturn{
		TenantID: tid,
		OrderID:  oid,
		CreatedBy: &actorID,
	}

	if err := h.store.CreateOrderReturn(c.Request.Context(), tid, ret, &req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	// Reload with items
	full, err := h.store.GetOrderReturn(c.Request.Context(), tid, ret.ID)
	if err != nil {
		c.JSON(http.StatusCreated, ret)
		return
	}
	c.JSON(http.StatusCreated, full)
}

// UpdateReturnStatus transitions a return to a new status (approve, reject, complete, cancel).
func (h *ReturnsHandler) UpdateReturnStatus(c *gin.Context) {
	tid := tenantID(c)
	rid, ok := pathUUID(c, "id")
	if !ok {
		return
	}

	var req models.ReturnStatusUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	// Validate status
	switch req.Status {
	case models.ReturnStatusApproved, models.ReturnStatusRejected, models.ReturnStatusCompleted, models.ReturnStatusCancelled:
		// ok
	default:
		errResponse(c, http.StatusBadRequest, "invalid status; must be 'approved', 'rejected', 'completed', or 'cancelled'")
		return
	}

	actor := userID(c).String()
	updated, err := h.store.UpdateReturnStatus(c.Request.Context(), tid, rid, req.Status, req.Note, actor)
	if err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ReturnCounts returns counts of returns grouped by status.
func (h *ReturnsHandler) ReturnCounts(c *gin.Context) {
	tid := tenantID(c)
	counts, err := h.store.ReturnCountsByStatus(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, counts)
}

// CustomerListOrderReturns returns returns for a specific order — for the logged-in customer.
func (h *ReturnsHandler) CustomerListOrderReturns(c *gin.Context) {
	tid := tenantID(c)
	oid, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	// If authenticated, verify the order belongs to the logged-in customer.
	// Guest users (no token) can access via order ID — same as GET /orders/:orderId.
	if uid := getUserID(c); uid != nil {
		owns, err := h.store.OrderBelongsToUser(c.Request.Context(), tid, oid, *uid)
		if err != nil || !owns {
			errResponse(c, http.StatusNotFound, "order not found")
			return
		}
	}
	returns, err := h.store.ListReturnsByOrder(c.Request.Context(), tid, oid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": returns})
}

// CustomerCreateReturn creates a return request from the logged-in customer or guest.
func (h *ReturnsHandler) CustomerCreateReturn(c *gin.Context) {
	tid := tenantID(c)
	oid, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}

	// If authenticated, verify the order belongs to the logged-in customer.
	// Guest users (no token) can create returns via order ID — same as GET /orders/:orderId.
	uid := getUserID(c)
	if uid != nil {
		owns, err := h.store.OrderBelongsToUser(c.Request.Context(), tid, oid, *uid)
		if err != nil || !owns {
			errResponse(c, http.StatusNotFound, "order not found")
			return
		}
	}

	var req models.ReturnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	// Validate type
	switch req.Type {
	case models.ReturnTypeRefund, models.ReturnTypeReplacement, models.ReturnTypeExchange, "":
		// ok
	default:
		errResponse(c, http.StatusBadRequest, "invalid return type; must be 'refund', 'replacement', or 'exchange'")
		return
	}

	// Enforce return validity period and type-allowed check based on the requested type
	elig, err := h.store.GetOrderReturnEligibility(c.Request.Context(), tid, oid)
	if err == nil && elig != nil {
		switch req.Type {
		case models.ReturnTypeRefund:
			if !elig.RefundAllowed {
				errResponse(c, http.StatusForbidden, "refunds are not available for the products in this order")
				return
			}
			if !elig.RefundEligible {
				errResponse(c, http.StatusForbidden, "the refund period for this order has expired")
				return
			}
		case models.ReturnTypeReplacement:
			if !elig.ReplacementAllowed {
				errResponse(c, http.StatusForbidden, "replacements are not available for the products in this order")
				return
			}
			if !elig.ReplacementEligible {
				errResponse(c, http.StatusForbidden, "the replacement period for this order has expired")
				return
			}
		default:
			if !elig.ReturnAllowed {
				errResponse(c, http.StatusForbidden, "returns are not available for the products in this order")
				return
			}
			if !elig.ReturnEligible {
				errResponse(c, http.StatusForbidden, "the return period for this order has expired")
				return
			}
		}
	}

	// Validate refund method
	switch req.RefundMethod {
	case "original", "wallet", "store_credit", "none", "":
		// ok
	default:
		errResponse(c, http.StatusBadRequest, "invalid refund method; must be 'original', 'wallet', 'store_credit', or 'none'")
		return
	}

	ret := &models.OrderReturn{
		TenantID: tid,
		OrderID:  oid,
		CreatedBy: uid,
	}

	if err := h.store.CreateOrderReturn(c.Request.Context(), tid, ret, &req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	// Reload with items
	full, err := h.store.GetOrderReturn(c.Request.Context(), tid, ret.ID)
	if err != nil {
		c.JSON(http.StatusCreated, ret)
		return
	}
	c.JSON(http.StatusCreated, full)
}

// CustomerGetReturnEligibility returns the return/refund/replacement eligibility
// for one of the logged-in customer's orders (or a guest's order via order ID).
func (h *ReturnsHandler) CustomerGetReturnEligibility(c *gin.Context) {
	tid := tenantID(c)
	oid, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	// If authenticated, verify ownership. Guest users access via order ID.
	if uid := getUserID(c); uid != nil {
		owns, err := h.store.OrderBelongsToUser(c.Request.Context(), tid, oid, *uid)
		if err != nil || !owns {
			errResponse(c, http.StatusNotFound, "order not found")
			return
		}
	}
	elig, err := h.store.GetOrderReturnEligibility(c.Request.Context(), tid, oid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, elig)
}

// CustomerListReturns returns all returns for the logged-in customer across all their orders.
func (h *ReturnsHandler) CustomerListReturns(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	returns, total, err := h.store.ListReturnsByUser(c.Request.Context(), tid, uid, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": returns, "total": total, "limit": limit, "offset": offset})
}
