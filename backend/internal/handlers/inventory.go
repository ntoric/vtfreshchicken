package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type InventoryHandler struct {
	store *services.Store
}

func NewInventoryHandler(store *services.Store) *InventoryHandler {
	return &InventoryHandler{store: store}
}

// ListInventory returns inventory items for the tenant. When a branch scope
// is active (branch-bound user or ?branch_id=/X-Branch-Id), the per-branch
// stock overlay is shown instead of store-level stock.
func (h *InventoryHandler) ListInventory(c *gin.Context) {
	filter := c.Query("filter") // "all", "products", "variants"
	tid := tenantID(c)
	var items []models.InventoryItem
	var err error
	if branchID := branchFilter(c); branchID != nil {
		items, err = h.store.ListBranchInventory(c.Request.Context(), tid, *branchID, filter)
	} else {
		items, err = h.store.ListInventory(c.Request.Context(), tid, filter)
	}
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// InventoryStats returns summary statistics for the inventory dashboard.
func (h *InventoryHandler) Stats(c *gin.Context) {
	stats, err := h.store.InventoryStats(c.Request.Context(), tenantID(c), branchFilter(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

type adjustStockReq struct {
	ProductID string `json:"product_id" binding:"required"`
	VariantID string `json:"variant_id"`
	Adjustment int   `json:"adjustment"`
	NewStock   *int  `json:"new_stock"`
	Reason     string `json:"reason"`
}

// AdjustStock adjusts or sets the stock level for a product or variant.
func (h *InventoryHandler) AdjustStock(c *gin.Context) {
	tid := tenantID(c)
	var req adjustStockReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid product_id")
		return
	}
	var variantID *uuid.UUID
	if req.VariantID != "" {
		vid, err := uuid.Parse(req.VariantID)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid variant_id")
			return
		}
		variantID = &vid
	}

	// Get user ID from context for created_by
	createdBy := getUserID(c)

	// Branch-scoped adjustments write the per-branch stock overlay
	// (branch_stock) instead of the shared store-level stock.
	if branchID := branchFilter(c); branchID != nil {
		target := req.NewStock
		var value int
		if target != nil {
			value = *target
		} else {
			// Delta adjustment against the effective branch stock.
			items, lerr := h.store.ListBranchInventory(c.Request.Context(), tid, *branchID, "all")
			if lerr != nil {
				errResponse(c, http.StatusInternalServerError, lerr.Error())
				return
			}
			found := false
			for _, it := range items {
				if it.ProductID == productID && ((it.VariantID == nil) == (variantID == nil)) &&
					(it.VariantID == nil || *it.VariantID == *variantID) {
					value = it.Stock + req.Adjustment
					found = true
					break
				}
			}
			if !found {
				errResponse(c, http.StatusNotFound, "inventory item not found")
				return
			}
		}
		if value < 0 {
			errResponse(c, http.StatusBadRequest, "stock cannot go below zero")
			return
		}
		if err := h.store.SetBranchStock(c.Request.Context(), tid, *branchID, productID, variantID, value, req.Reason, createdBy); err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
		c.JSON(http.StatusOK, gin.H{"updated": true})
		return
	}

	if req.NewStock != nil {
		if err := h.store.SetStock(c.Request.Context(), tid, productID, variantID, *req.NewStock, req.Reason, createdBy); err != nil {
			notFoundOrErr(c, err, "inventory item not found")
			return
		}
	} else {
		if err := h.store.AdjustStock(c.Request.Context(), tid, productID, variantID, req.Adjustment, req.Reason, createdBy); err != nil {
			notFoundOrErr(c, err, "inventory item not found")
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

// ListStockMovements returns the stock movement audit log.
func (h *InventoryHandler) ListStockMovements(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	f := services.StockMovementFilter{
		MovementType: c.Query("movement_type"),
		BranchID:     branchFilter(c),
		Search:       c.Query("search"),
		Dr:           services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")},
	}
	movements, total, err := h.store.ListStockMovementsFiltered(c.Request.Context(), tenantID(c), f, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": movements, "total": total, "limit": limit, "offset": offset})
}
