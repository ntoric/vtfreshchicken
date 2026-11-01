package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// ShopBannersHandler manages the /shop banner carousel
// (Backoffice → Content → Shop Banners). Route-gated by settings.manage.
type ShopBannersHandler struct {
	store *services.Store
}

func NewShopBannersHandler(store *services.Store) *ShopBannersHandler {
	return &ShopBannersHandler{store: store}
}

func shopBannersPayload(banners []models.ShopBanner, customized bool) gin.H {
	return gin.H{
		"banners":    banners,
		"customized": customized,
		"defaults":   services.DefaultShopBanners(),
		"themes":     services.ShopBannerThemes,
		"max":        services.MaxShopBanners,
	}
}

// Get returns the banners plus the defaults and selectable themes.
func (h *ShopBannersHandler) Get(c *gin.Context) {
	bs, custom, err := h.store.GetShopBanners(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, shopBannersPayload(bs, custom))
}

// Update replaces the banner list. Body: {"banners": [...]} — order is display
// order. {"reset": true} restores the built-in defaults.
func (h *ShopBannersHandler) Update(c *gin.Context) {
	var req struct {
		Banners []models.ShopBanner `json:"banners"`
		Reset   bool                `json:"reset"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	in := req.Banners
	if req.Reset {
		in = nil
	} else if in == nil {
		in = []models.ShopBanner{} // explicit "no banners"
	}
	bs, err := h.store.SetShopBanners(c.Request.Context(), tenantID(c), in)
	if err != nil {
		if errors.Is(err, services.ErrInvalidShopBanners) {
			errResponse(c, http.StatusBadRequest, err.Error())
			return
		}
		notFoundOrErr(c, err, "store settings not found")
		return
	}
	c.JSON(http.StatusOK, shopBannersPayload(bs, !req.Reset))
}
