package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// SetupHandler handles the initial installation/setup flow.
type SetupHandler struct {
	store  *services.Store
	hashPw func(string) (string, error)
}

func NewSetupHandler(store *services.Store, hashPw func(string) (string, error)) *SetupHandler {
	return &SetupHandler{store: store, hashPw: hashPw}
}

// Status returns whether the store needs initial setup.
// Setup is needed when no store (tenant) has been created yet.
func (h *SetupHandler) Status(c *gin.Context) {
	ctx := c.Request.Context()
	superAdminCount, _ := h.store.CountSuperAdmins(ctx)
	tenantCount, _ := h.store.CountTenants(ctx)

	c.JSON(http.StatusOK, gin.H{
		"needs_setup":      tenantCount == 0,
		"has_store":        tenantCount > 0,
		"setup_complete":   tenantCount > 0,
		"has_superadmin":   superAdminCount > 0,
		"superadmin_count": superAdminCount,
		"tenant_count":     tenantCount,
	})
}

type setupCompleteReq struct {
	// Store details
	StoreName        string `json:"store_name" binding:"required"`
	StoreSlug        string `json:"store_slug"`
	StoreDescription string `json:"store_description"`
	// Store admin account
	AdminEmail    string `json:"admin_email" binding:"required,email"`
	AdminPassword string `json:"admin_password" binding:"required,min=6"`
	AdminName     string `json:"admin_name" binding:"required"`
	// Optional store settings
	DefaultLanguage    string   `json:"default_language"`
	SupportedLanguages []string `json:"supported_languages"`
	BrandColor         string   `json:"brand_color"`
}

// Complete performs the initial setup: creates the store + its business admin.
// This endpoint is only accessible while no store exists.
func (h *SetupHandler) Complete(c *gin.Context) {
	ctx := c.Request.Context()

	// Guard: only allow when setup is actually needed
	if tenantCount, _ := h.store.CountTenants(ctx); tenantCount > 0 {
		errResponse(c, http.StatusConflict, "setup is already complete")
		return
	}

	var req setupCompleteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	// Apply defaults
	if req.DefaultLanguage == "" {
		req.DefaultLanguage = "en"
	}
	if len(req.SupportedLanguages) == 0 {
		req.SupportedLanguages = []string{"en"}
	}
	if req.BrandColor == "" {
		req.BrandColor = "#4f46e5"
	}
	slug := req.StoreSlug
	if slug == "" {
		slug = slugify(req.StoreName)
	}
	if slug == "" {
		slug = "store"
	}

	// Create the store
	t, err := h.store.CreateTenant(ctx, slug, req.StoreName, req.StoreDescription)
	if err != nil {
		errResponse(c, http.StatusConflict, "store slug already exists: "+err.Error())
		return
	}

	// Create the store admin
	hash, err := h.hashPw(req.AdminPassword)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to hash admin password: "+err.Error())
		return
	}
	admin, err := h.store.CreateBusinessAdmin(ctx, t.ID, req.AdminEmail, req.AdminName, hash)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to create store admin: "+err.Error())
		return
	}

	// Create default store settings
	_ = h.store.UpsertTenantSettings(ctx, &models.TenantSettings{
		TenantID:           t.ID,
		DefaultLanguage:    req.DefaultLanguage,
		SupportedLanguages: req.SupportedLanguages,
		BrandColor:         req.BrandColor,
		ReturnsEnabled:     true,
	})

	// Seed default permissions
	_ = h.store.SeedDefaultPermissions(ctx, t.ID)

	c.JSON(http.StatusCreated, gin.H{"store": t, "admin": admin, "setup_complete": true})
}
