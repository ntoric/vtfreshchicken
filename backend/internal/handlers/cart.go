package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/config"
	"github.com/trucommerce/backend/internal/middleware"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// cookieSecure is set by NewCartHandler from the app config.
// It controls whether the session cookie gets the Secure flag.
var cookieSecure bool

type CartHandler struct {
	store *services.Store
}

func NewCartHandler(store *services.Store, cfg *config.Config) *CartHandler {
	cookieSecure = cfg.CookieSecure
	return &CartHandler{store: store}
}

// getSessionID extracts the session ID from a cookie, or generates one.
// For unauthenticated users, we use a session cookie to track their cart.
func getSessionID(c *gin.Context) string {
	sessionID, _ := c.Cookie("tc_session")
	if sessionID == "" {
		sessionID = uuid.NewString()
		c.SetCookie("tc_session", sessionID, 30*24*3600, "/", "", cookieSecure, true)
	}
	return sessionID
}

// getUserID returns the user ID if authenticated, nil otherwise.
func getUserID(c *gin.Context) *uuid.UUID {
	if v, ok := c.Get(middleware.CtxUserID); ok {
		uid := v.(uuid.UUID)
		return &uid
	}
	return nil
}

type addCartReq struct {
	ProductID string `json:"product_id" binding:"required"`
	VariantID string `json:"variant_id"`
	Quantity  int    `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
	Currency  string  `json:"currency"`
}

// GetCart returns the current user's/session's cart.
func (h *CartHandler) GetCart(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	currency := c.Query("currency")
	if currency == "" {
		currency = "USD"
	}
	cart, err := h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, currency)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	subtotal := services.CartSubtotal(cart)
	c.JSON(http.StatusOK, gin.H{
		"cart":      cart,
		"subtotal":  subtotal,
		"item_count": len(cart.Items),
	})
}

// AddItem adds a product/variant to the cart.
func (h *CartHandler) AddItem(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)

	var req addCartReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Quantity <= 0 {
		req.Quantity = 1
	}
	currency := req.Currency
	if currency == "" {
		currency = "USD"
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

	// If unit_price not provided, fetch from DB
	if req.UnitPrice == 0 {
		if variantID != nil {
			err := h.store.Pool.QueryRow(c.Request.Context(),
				`SELECT price FROM variants WHERE id=$1`, *variantID).Scan(&req.UnitPrice)
			if err != nil {
				errResponse(c, http.StatusBadRequest, "variant not found")
				return
			}
		} else {
			// Try product base_price first, fall back to first variant price
			err := h.store.Pool.QueryRow(c.Request.Context(),
				`SELECT base_price FROM products WHERE id=$1 AND tenant_id=$2`, productID, tid).Scan(&req.UnitPrice)
			if err != nil {
				errResponse(c, http.StatusBadRequest, "product not found")
				return
			}
			if req.UnitPrice == 0 {
				err := h.store.Pool.QueryRow(c.Request.Context(),
					`SELECT price FROM variants WHERE product_id=$1 AND price > 0 ORDER BY created_at ASC LIMIT 1`, productID).Scan(&req.UnitPrice)
				if err == nil {
					// found a variant price — use it
				}
			}
		}
	}

	cart, err := h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, currency)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.AddToCart(c.Request.Context(), cart.ID, productID, variantID, req.Quantity, req.UnitPrice); err != nil {
		// Stock validation errors are 400, others are 500
		if strings.Contains(err.Error(), "insufficient stock") {
			errResponse(c, http.StatusBadRequest, err.Error())
		} else {
			errResponse(c, http.StatusInternalServerError, err.Error())
		}
		return
	}
	cart, err = h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, currency)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	subtotal := services.CartSubtotal(cart)
	c.JSON(http.StatusOK, gin.H{
		"cart":       cart,
		"subtotal":   subtotal,
		"item_count": len(cart.Items),
	})
}

type updateCartReq struct {
	Quantity int `json:"quantity" binding:"required"`
}

// UpdateItem changes the quantity of a cart item.
func (h *CartHandler) UpdateItem(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	itemID, ok := pathUUID(c, "itemId")
	if !ok {
		return
	}
	var req updateCartReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	cart, err := h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, "USD")
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.UpdateCartItem(c.Request.Context(), cart.ID, itemID, req.Quantity); err != nil {
		if strings.Contains(err.Error(), "insufficient stock") {
			errResponse(c, http.StatusBadRequest, err.Error())
		} else {
			notFoundOrErr(c, err, "cart item not found")
		}
		return
	}
	cart, err = h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, "USD")
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	subtotal := services.CartSubtotal(cart)
	c.JSON(http.StatusOK, gin.H{
		"cart":       cart,
		"subtotal":   subtotal,
		"item_count": len(cart.Items),
	})
}

// RemoveItem deletes an item from the cart.
func (h *CartHandler) RemoveItem(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	itemID, ok := pathUUID(c, "itemId")
	if !ok {
		return
	}
	cart, err := h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, "USD")
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.RemoveCartItem(c.Request.Context(), cart.ID, itemID); err != nil {
		notFoundOrErr(c, err, "cart item not found")
		return
	}
	cart, err = h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, "USD")
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	subtotal := services.CartSubtotal(cart)
	c.JSON(http.StatusOK, gin.H{
		"cart":       cart,
		"subtotal":   subtotal,
		"item_count": len(cart.Items),
	})
}

// ClearCart empties the cart.
func (h *CartHandler) ClearCart(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	cart, err := h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, "USD")
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.ClearCart(c.Request.Context(), cart.ID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	cart.Items = []models.CartItem{}
	c.JSON(http.StatusOK, gin.H{
		"cart":       cart,
		"subtotal":   0,
		"item_count": 0,
	})
}

// CartCount returns just the item count (for header badge).
func (h *CartHandler) CartCount(c *gin.Context) {
	tid := tenantID(c)
	sessionID := getSessionID(c)
	userID := getUserID(c)
	currency := c.Query("currency")
	if currency == "" {
		currency = "USD"
	}
	cart, err := h.store.GetOrCreateCart(c.Request.Context(), tid, userID, sessionID, currency)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"count": 0})
		return
	}
	count := 0
	for _, item := range cart.Items {
		count += item.Quantity
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}
