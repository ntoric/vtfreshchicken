package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/services"
)

// ModulesHandler serves the store module / feature flags managed under
// Backoffice → Developer → Modules & Features.
type ModulesHandler struct {
	store *services.Store
}

func NewModulesHandler(store *services.Store) *ModulesHandler {
	return &ModulesHandler{store: store}
}

// PublicList returns all modules with their enabled state. Public so the
// storefront and any client can hide features that are turned off.
func (h *ModulesHandler) PublicList(c *gin.Context) {
	tid := tenantID(c)
	_ = h.store.EnsureDefaultModules(c.Request.Context(), tid)
	mods, err := h.store.ListModules(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	enabled := make(map[string]bool, len(mods))
	for _, m := range mods {
		enabled[m.ModuleCode] = m.IsEnabled
	}
	c.JSON(http.StatusOK, gin.H{"items": mods, "modules": enabled})
}

// Update toggles a module. Superadmin only (route-gated).
func (h *ModulesHandler) Update(c *gin.Context) {
	tid := tenantID(c)
	code := c.Param("code")
	var req struct {
		IsEnabled bool `json:"is_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	m, err := h.store.SetModuleEnabled(c.Request.Context(), tid, code, req.IsEnabled)
	if err != nil {
		notFoundOrErr(c, err, "module not found")
		return
	}
	c.JSON(http.StatusOK, m)
}
