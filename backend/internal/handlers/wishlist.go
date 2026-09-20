package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/services"
)

type WishlistHandler struct {
	store *services.Store
}

func NewWishlistHandler(store *services.Store) *WishlistHandler {
	return &WishlistHandler{store: store}
}

type addWishlistReq struct {
	ProductID string `json:"product_id" binding:"required"`
	VariantID string `json:"variant_id"`
}

func (h *WishlistHandler) GetWishlist(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	wl, err := h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"wishlist":    wl,
		"item_count":  len(wl.Items),
	})
}

func (h *WishlistHandler) AddItem(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)

	var req addWishlistReq
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
	wl, err := h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.AddToWishlist(c.Request.Context(), wl.ID, productID, variantID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	wl, err = h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"wishlist":   wl,
		"item_count": len(wl.Items),
	})
}

func (h *WishlistHandler) RemoveItem(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	itemID, ok := pathUUID(c, "itemId")
	if !ok {
		return
	}
	wl, err := h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.RemoveFromWishlist(c.Request.Context(), wl.ID, itemID); err != nil {
		notFoundOrErr(c, err, "wishlist item not found")
		return
	}
	wl, err = h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"wishlist":   wl,
		"item_count": len(wl.Items),
	})
}

func (h *WishlistHandler) RemoveByProduct(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	productID, ok := pathUUID(c, "productId")
	if !ok {
		return
	}
	wl, err := h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.RemoveProductFromWishlist(c.Request.Context(), wl.ID, productID, nil); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	wl, err = h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"wishlist":   wl,
		"item_count": len(wl.Items),
	})
}

func (h *WishlistHandler) ClearWishlist(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	wl, err := h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.ClearWishlist(c.Request.Context(), wl.ID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	wl.Items = nil
	c.JSON(http.StatusOK, gin.H{
		"wishlist":   wl,
		"item_count": 0,
	})
}

func (h *WishlistHandler) CheckProduct(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	productID, ok := pathUUID(c, "productId")
	if !ok {
		return
	}
	wl, err := h.store.GetOrCreateWishlist(c.Request.Context(), tid, userID, sessionID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"in_wishlist": false})
		return
	}
	in, err := h.store.IsInWishlist(c.Request.Context(), wl.ID, productID, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"in_wishlist": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"in_wishlist": in})
}
