package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/services"
)

// LandingHandler manages the storefront homepage design
// (Backoffice → Developer → Landing Page). Superadmin only (route-gated).
type LandingHandler struct {
	store *services.Store
}

func NewLandingHandler(store *services.Store) *LandingHandler {
	return &LandingHandler{store: store}
}

// Get returns the active variant and the selectable options.
func (h *LandingHandler) Get(c *gin.Context) {
	v, err := h.store.GetLandingVariant(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"landing_variant": v, "options": services.LandingVariants})
}

// Update sets the active variant. Body: {"landing_variant": "classic"|"minimal"|"malayalam"}.
func (h *LandingHandler) Update(c *gin.Context) {
	var req struct {
		LandingVariant string `json:"landing_variant" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if !services.IsValidLandingVariant(req.LandingVariant) {
		errResponse(c, http.StatusBadRequest, "landing_variant must be one of: "+strings.Join(services.LandingVariants, ", "))
		return
	}
	if err := h.store.SetLandingVariant(c.Request.Context(), tenantID(c), req.LandingVariant); err != nil {
		notFoundOrErr(c, err, "store settings not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"landing_variant": req.LandingVariant, "options": services.LandingVariants})
}
