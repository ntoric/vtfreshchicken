package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// DeliveryHandler serves the delivery-partner portal and the staff-side
// delivery assignment endpoints.
type DeliveryHandler struct {
	store *services.Store
}

func NewDeliveryHandler(store *services.Store) *DeliveryHandler {
	return &DeliveryHandler{store: store}
}

// branchScope resolves which branches the caller may see:
//   - delivery_partner → the branches allocated to them (error when none)
//   - staff/managers/admins → the resolved branch filter (nil = all branches)
func (h *DeliveryHandler) branchScope(c *gin.Context) ([]uuid.UUID, error) {
	if userRole(c) == models.RoleDeliveryPartner {
		ids, err := h.store.GetDeliveryPartnerBranchIDs(c.Request.Context(), tenantID(c), userID(c))
		if err != nil {
			return nil, err
		}
		if len(ids) == 0 {
			return nil, services.ErrNoBranchAllocated
		}
		return ids, nil
	}
	if scope := branchFilter(c); scope != nil {
		return []uuid.UUID{*scope}, nil
	}
	return nil, nil
}

// orderInScope reports whether the order's branch is visible to the caller —
// mirrors OrderHandler.orderBranchAllowed for non-partner staff.
func (h *DeliveryHandler) orderInScope(c *gin.Context, tid, orderID uuid.UUID) bool {
	scope := branchFilter(c)
	if scope == nil || !branchRestricted(c) {
		return true
	}
	ok, err := h.store.OrderInBranch(c.Request.Context(), tid, orderID, *scope)
	return err == nil && ok
}

func deliveryErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrNoBranchAllocated):
		errResponse(c, http.StatusForbidden, "your account has no branch allocated — ask an admin to allocate you to a branch")
	case errors.Is(err, services.ErrNotClaimable):
		errResponse(c, http.StatusConflict, "order is no longer available for delivery")
	case errors.Is(err, services.ErrNotAssignedToYou):
		errResponse(c, http.StatusForbidden, "this order is not assigned to you")
	case errors.Is(err, services.ErrBranchNotCovered):
		errResponse(c, http.StatusBadRequest, "this partner is not allocated to the order's branch")
	case errors.Is(err, pgx.ErrNoRows):
		errResponse(c, http.StatusNotFound, "order not found")
	default:
		errResponse(c, http.StatusBadRequest, err.Error())
	}
}

func (h *DeliveryHandler) respondOrder(c *gin.Context, tid, orderID uuid.UUID, msg string) {
	order, err := h.store.GetOrderWithDetails(c.Request.Context(), tid, orderID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"order": order, "message": msg})
}

// Branches returns the branches the caller may see — a partner's allocated
// branches, or all/scoped branches for staff.
func (h *DeliveryHandler) Branches(c *gin.Context) {
	tid := tenantID(c)
	if userRole(c) == models.RoleDeliveryPartner {
		items, err := h.store.ListDeliveryPartnerBranches(c.Request.Context(), tid, userID(c))
		if err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
		return
	}
	if scope := branchFilter(c); scope != nil {
		b, err := h.store.GetBranch(c.Request.Context(), tid, *scope)
		if err != nil {
			notFoundOrErr(c, err, "branch not found")
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": []models.Branch{*b}})
		return
	}
	items, err := h.store.ListBranches(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// ListOrders powers the delivery queue.
//   ?view=queue    — 'ready' orders in scope (default; includes assigned ones
//                    so staff/partners can see who owns them)
//   ?view=active   — assigned orders still in flight (ready or shipped)
//   ?view=history  — delivered orders that had a partner assigned
//
// Delivery partners are always scoped to their allocated branches; the
// active/history views are additionally limited to orders assigned to them.
func (h *DeliveryHandler) ListOrders(c *gin.Context) {
	tid := tenantID(c)
	uid := userID(c)
	isPartner := userRole(c) == models.RoleDeliveryPartner

	branchIDs, err := h.branchScope(c)
	if err != nil {
		deliveryErr(c, err)
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	f := services.DeliveryOrderFilter{BranchIDs: branchIDs, Limit: limit, Offset: offset}
	switch c.DefaultQuery("view", "queue") {
	case "active":
		f.Statuses = []string{"ready", "shipped"}
	case "history":
		f.Statuses = []string{"delivered"}
	default: // queue
		f.Statuses = []string{"ready"}
	}

	if isPartner {
		if c.DefaultQuery("view", "queue") != "queue" {
			f.PartnerID = &uid
		}
	} else if pid := c.Query("partner_id"); pid != "" {
		if id, perr := uuid.Parse(pid); perr == nil {
			f.PartnerID = &id
		}
	}
	if c.Query("unassigned") == "true" {
		f.Unassigned = true
	}

	items, total, err := h.store.ListDeliveryOrders(c.Request.Context(), tid, f)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "limit": limit, "offset": offset})
}

// Claim — partner takes an unassigned 'ready' order at one of their branches;
// the order is assigned to them and goes out for delivery in one step.
func (h *DeliveryHandler) Claim(c *gin.Context) {
	tid := tenantID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	if err := h.store.ClaimDelivery(c.Request.Context(), tid, orderID, userID(c)); err != nil {
		deliveryErr(c, err)
		return
	}
	h.respondOrder(c, tid, orderID, "Order claimed — out for delivery")
}

// Start — partner begins a delivery that staff assigned to them (ready → shipped).
func (h *DeliveryHandler) Start(c *gin.Context) {
	tid := tenantID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	if err := h.store.StartDelivery(c.Request.Context(), tid, orderID, userID(c)); err != nil {
		deliveryErr(c, err)
		return
	}
	h.respondOrder(c, tid, orderID, "Out for delivery")
}

// Deliver — partner marks one of their out-for-delivery orders as delivered.
func (h *DeliveryHandler) Deliver(c *gin.Context) {
	tid := tenantID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	if err := h.store.CompleteDelivery(c.Request.Context(), tid, orderID, userID(c)); err != nil {
		deliveryErr(c, err)
		return
	}
	h.respondOrder(c, tid, orderID, "Order delivered")
}

type assignDeliveryReq struct {
	PartnerID string `json:"partner_id"` // uuid to assign, "" to unassign
}

// Assign — staff/manager/admin assigns (or unassigns) a delivery partner to a
// ready or out-for-delivery order.
func (h *DeliveryHandler) Assign(c *gin.Context) {
	tid := tenantID(c)
	orderID, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	if !h.orderInScope(c, tid, orderID) {
		errResponse(c, http.StatusNotFound, "order not found")
		return
	}
	var req assignDeliveryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}
	var partnerID *uuid.UUID
	if req.PartnerID != "" {
		id, err := uuid.Parse(req.PartnerID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid partner_id")
			return
		}
		partnerID = &id
	}
	actor := userID(c).String()
	if err := h.store.AssignDeliveryPartner(c.Request.Context(), tid, orderID, partnerID, actor); err != nil {
		deliveryErr(c, err)
		return
	}
	msg := "Delivery partner unassigned"
	if partnerID != nil {
		msg = "Delivery partner assigned"
	}
	h.respondOrder(c, tid, orderID, msg)
}

// ListPartners — active delivery partners for the assignment picker,
// optionally filtered to a branch (?branch_id= or X-Branch-Id header).
func (h *DeliveryHandler) ListPartners(c *gin.Context) {
	tid := tenantID(c)
	var branchID *uuid.UUID
	if raw := c.Query("branch_id"); raw != "" && raw != "all" {
		if id, err := uuid.Parse(raw); err == nil {
			branchID = &id
		}
	} else {
		branchID = branchFilter(c)
	}
	items, err := h.store.ListDeliveryPartners(c.Request.Context(), tid, branchID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
