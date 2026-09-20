package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/middleware"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// OrderHandler handles order management endpoints for the backoffice.
type OrderHandler struct {
	store *services.Store
}

func NewOrderHandler(store *services.Store) *OrderHandler {
	return &OrderHandler{store: store}
}

// GetOrder returns a single order with full details (items, addresses, status history).
// Admin-only endpoint.
func (h *OrderHandler) GetOrder(c *gin.Context) {
	tid := tenantID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	order, err := h.store.GetOrderWithDetails(c.Request.Context(), tid, orderID)
	if err != nil {
		notFoundOrErr(c, err, "order not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"order": order})
}

// ListOrders returns a filtered, paginated list of orders for the backoffice.
// Supports status, search, and date range query parameters.
func (h *OrderHandler) ListOrders(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	search := c.Query("search")

	f := services.OrderListFilter{
		Status: status,
		Search: search,
		Dr:     services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")},
	}
	items, total, err := h.store.ListOrdersFiltered(c.Request.Context(), tid, f, limit, offset)
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

// UpdateStatusRequest is the payload for transitioning an order's status.
type UpdateStatusRequest struct {
	Status          string `json:"status" binding:"required"`
	Note            string `json:"note,omitempty"`
	TrackingNumber  string `json:"tracking_number,omitempty"`
	Carrier         string `json:"carrier,omitempty"`
}

// UpdateStatus transitions an order to a new status following the workflow rules.
// Sets tracking info when transitioning to "shipped" and timestamps for terminal states.
func (h *OrderHandler) UpdateStatus(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	// Validate the status is a known value
	validStatuses := map[string]bool{
		"pending": true, "paid": true, "processing": true, "shipped": true,
		"delivered": true, "fulfilled": true, "cancelled": true, "refunded": true, "failed": true,
	}
	if !validStatuses[req.Status] {
		errResponse(c, http.StatusBadRequest, "unknown status: "+req.Status)
		return
	}

	// Only superadmins may manually mark an order as fulfilled. For everyone
	// else, the delivered → fulfilled transition happens automatically once all
	// return/refund/replacement periods have expired (see CheckAndFulfillOrder).
	if req.Status == "fulfilled" {
		role, _ := c.Get(middleware.CtxUserRole)
		if role != models.RoleSuperAdmin {
			errResponse(c, http.StatusForbidden, "orders are fulfilled automatically when the return period expires; manual fulfillment is restricted to superadmins")
			return
		}
	}

	actor := "system"
	if uid != (uuid.UUID{}) {
		actor = uid.String()
	}

	order, err := h.store.UpdateOrderStatus(c.Request.Context(), tid, orderID, req.Status, req.Note, actor, req.TrackingNumber, req.Carrier)
	if err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"order":   order,
		"message": "Order status updated to " + req.Status,
	})
}

// UpdateNotesRequest is the payload for updating internal staff notes on an order.
type UpdateNotesRequest struct {
	Notes string `json:"notes"`
}

// UpdateNotes updates the internal notes field on an order (staff-only, not visible to customers).
func (h *OrderHandler) UpdateNotes(c *gin.Context) {
	tid := tenantID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}

	var req UpdateNotesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.store.UpdateOrderNotes(c.Request.Context(), tid, orderID, req.Notes); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true, "notes": req.Notes})
}

// OrderCounts returns order counts grouped by status (for the backoffice dashboard/tabs).
func (h *OrderHandler) OrderCounts(c *gin.Context) {
	tid := tenantID(c)
	counts, err := h.store.OrderCountsByStatus(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"counts": counts})
}
