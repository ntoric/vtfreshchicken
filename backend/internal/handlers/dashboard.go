package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/services"
)

type DashboardHandler struct {
	store *services.Store
}

func NewDashboardHandler(store *services.Store) *DashboardHandler {
	return &DashboardHandler{store: store}
}

func (h *DashboardHandler) Stats(c *gin.Context) {
	tid := tenantID(c)
	dr := services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")}
	stats, err := h.store.DashboardStats(c.Request.Context(), tid, dr, branchFilter(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *DashboardHandler) ListOrders(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, total, err := h.store.ListOrders(c.Request.Context(), tid, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "limit": limit, "offset": offset})
}
