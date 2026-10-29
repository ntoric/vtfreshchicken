package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// HandoffHandler manages order branch handoffs — passing an order (or
// specific items) to another branch, and the accept/reject workflow.
type HandoffHandler struct {
	store *services.Store
}

func NewHandoffHandler(store *services.Store) *HandoffHandler {
	return &HandoffHandler{store: store}
}

// handoffOrderAccess mirrors OrderHandler.orderBranchAllowed — a branch-bound
// user can only hand off orders fulfilled by (or carrying items for) their
// branch, or orders with a pending handoff addressed to their branch.
func (h *HandoffHandler) orderAccess(c *gin.Context, tid, orderID uuid.UUID) bool {
	scope := branchFilter(c)
	if scope == nil || !branchRestricted(c) {
		return true
	}
	ok, err := h.store.OrderInBranch(c.Request.Context(), tid, orderID, *scope)
	if err == nil && ok {
		return true
	}
	ok, err = h.store.PendingHandoffToBranch(c.Request.Context(), tid, orderID, *scope)
	return err == nil && ok
}

type handoffReq struct {
	ToBranchID *string  `json:"to_branch_id"` // empty = auto-resolve nearest other serviceable branch
	ItemIDs    []string `json:"item_ids"`     // empty = whole order
	Note       string   `json:"note"`
}

// Create starts a handoff for an order. The origin branch is the caller's
// scope (or the order's own branch for admins).
func (h *HandoffHandler) Create(c *gin.Context) {
	tid := tenantID(c)
	oid, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	if !h.orderAccess(c, tid, oid) {
		errResponse(c, http.StatusNotFound, "order not found")
		return
	}
	var req handoffReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	from, err := h.store.GetOrderBranchID(c.Request.Context(), tid, oid)
	if err != nil || from == nil {
		errResponse(c, http.StatusBadRequest, "order has no assigned branch")
		return
	}
	var to uuid.UUID
	if req.ToBranchID != nil && *req.ToBranchID != "" {
		if t, perr := uuid.Parse(*req.ToBranchID); perr != nil {
			errResponse(c, http.StatusBadRequest, "invalid to_branch_id")
			return
		} else {
			to = t
		}
		if _, bErr := h.store.GetBranch(c.Request.Context(), tid, to); bErr != nil {
			errResponse(c, http.StatusBadRequest, "target branch not found")
			return
		}
	} else {
		// Auto-resolve: nearest active branch other than the origin.
		branches, bErr := h.store.ListActiveBranches(c.Request.Context(), tid)
		if bErr != nil {
			errResponse(c, http.StatusInternalServerError, bErr.Error())
			return
		}
		found := false
		for _, b := range branches {
			if b.ID != *from {
				to = b.ID
				found = true
				break
			}
		}
		if !found {
			errResponse(c, http.StatusBadRequest, "no other active branch to hand off to")
			return
		}
	}
	if to == *from {
		errResponse(c, http.StatusBadRequest, "cannot hand off to the order's own branch")
		return
	}
	// Branch-bound staff may only hand off from their own branch.
	if branchRestricted(c) {
		if scope := branchFilter(c); scope != nil && *scope != *from {
			errResponse(c, http.StatusForbidden, "order is not assigned to your branch")
			return
		}
	}
	items := []uuid.UUID{}
	for _, raw := range req.ItemIDs {
		if id, perr := uuid.Parse(raw); perr == nil {
			items = append(items, id)
		}
	}
	uid := userID(c)
	ho := &models.OrderHandoff{
		TenantID: tid, OrderID: oid, FromBranchID: *from, ToBranchID: to,
		ItemIDs: items, Note: req.Note, CreatedBy: &uid,
	}
	if err := h.store.CreateOrderHandoff(c.Request.Context(), ho); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusCreated, ho)
}

// ListForOrder returns handoff history for an order.
func (h *HandoffHandler) ListForOrder(c *gin.Context) {
	tid := tenantID(c)
	oid, ok := pathUUID(c, "orderId")
	if !ok {
		return
	}
	if !h.orderAccess(c, tid, oid) {
		errResponse(c, http.StatusNotFound, "order not found")
		return
	}
	items, err := h.store.ListOrderHandoffs(c.Request.Context(), tid, oid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// ListIncoming returns pending handoffs addressed to the caller's branch —
// the receiving branch's accept/reject queue.
func (h *HandoffHandler) ListIncoming(c *gin.Context) {
	tid := tenantID(c)
	scope := branchFilter(c)
	if scope == nil {
		// Unscoped admins see the global pending queue.
		items, err := h.store.ListPendingHandoffs(c.Request.Context(), tid)
		if err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
		return
	}
	items, err := h.store.ListIncomingHandoffs(c.Request.Context(), tid, *scope)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

type handoffRespondReq struct {
	Action string `json:"action" binding:"required"` // accept, reject, cancel
}

// Respond accepts, rejects, or cancels a pending handoff. Only the receiving
// branch's staff may accept/reject; only the origin branch may cancel.
func (h *HandoffHandler) Respond(c *gin.Context) {
	tid := tenantID(c)
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	var req handoffRespondReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Action != "accept" && req.Action != "reject" && req.Action != "cancel" {
		errResponse(c, http.StatusBadRequest, "action must be accept, reject or cancel")
		return
	}
	ho, err := h.store.GetOrderHandoff(c.Request.Context(), tid, id)
	if err != nil || ho == nil {
		errResponse(c, http.StatusNotFound, "handoff not found")
		return
	}
	if branchRestricted(c) {
		scope := branchFilter(c)
		switch req.Action {
		case "accept", "reject":
			if scope == nil || *scope != ho.ToBranchID {
				errResponse(c, http.StatusForbidden, "only the receiving branch can respond")
				return
			}
		case "cancel":
			if scope == nil || *scope != ho.FromBranchID {
				errResponse(c, http.StatusForbidden, "only the origin branch can cancel")
				return
			}
		}
	}
	status := map[string]string{"accept": "accepted", "reject": "rejected", "cancel": "cancelled"}[req.Action]
	if err := h.store.RespondToHandoff(c.Request.Context(), ho, status, userID(c).String()); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true, "status": status})
}
