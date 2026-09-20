package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trucommerce/backend/internal/auth"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// SetupHandler handles the initial installation/setup flow.
type SetupHandler struct {
	store   *services.Store
	hashPw  func(string) (string, error)
}

func NewSetupHandler(store *services.Store, hashPw func(string) (string, error)) *SetupHandler {
	return &SetupHandler{store: store, hashPw: hashPw}
}

// Status returns whether the platform needs initial setup.
// Setup is needed when there are no superadmin accounts AND no tenants.
// If a superadmin exists but no tenants, only the tenant-creation step is needed.
func (h *SetupHandler) Status(c *gin.Context) {
	ctx := c.Request.Context()
	superAdminCount, _ := h.store.CountSuperAdmins(ctx)
	tenantCount, _ := h.store.CountTenants(ctx)

	needsSetup := superAdminCount == 0 && tenantCount == 0
	needsTenant := superAdminCount > 0 && tenantCount == 0

	c.JSON(http.StatusOK, gin.H{
		"needs_setup":       needsSetup,
		"needs_tenant":      needsTenant,
		"has_superadmin":    superAdminCount > 0,
		"has_tenants":       tenantCount > 0,
		"superadmin_count":  superAdminCount,
		"tenant_count":      tenantCount,
		"setup_complete":    superAdminCount > 0 && tenantCount > 0,
	})
}

type setupCompleteReq struct {
	// Superadmin credentials (required when no superadmin exists)
	SuperAdminEmail    string `json:"superadmin_email" binding:"required,email"`
	SuperAdminPassword string `json:"superadmin_password" binding:"required,min=8"`
	SuperAdminName     string `json:"superadmin_name" binding:"required"`
	// First tenant + its business admin
	TenantSlug        string `json:"tenant_slug" binding:"required"`
	TenantName        string `json:"tenant_name" binding:"required"`
	TenantDescription string `json:"tenant_description"`
	AdminEmail        string `json:"admin_email" binding:"required,email"`
	AdminPassword     string `json:"admin_password" binding:"required,min=6"`
	AdminName         string `json:"admin_name" binding:"required"`
	// Optional tenant settings
	DefaultLanguage    string `json:"default_language"`
	SupportedLanguages []string `json:"supported_languages"`
	BrandColor         string `json:"brand_color"`
}

// Complete performs the full initial setup: creates superadmin (if none) + first tenant + business admin.
// This endpoint is only accessible when setup is needed (no superadmin or no tenants).
func (h *SetupHandler) Complete(c *gin.Context) {
	ctx := c.Request.Context()

	// Guard: only allow when setup is actually needed
	superAdminCount, _ := h.store.CountSuperAdmins(ctx)
	tenantCount, _ := h.store.CountTenants(ctx)
	if superAdminCount > 0 && tenantCount > 0 {
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

	result := gin.H{}

	// Step 1: Create superadmin (if none exists)
	if superAdminCount == 0 {
		hash, err := h.hashPw(req.SuperAdminPassword)
		if err != nil {
			errResponse(c, http.StatusInternalServerError, "failed to hash superadmin password: "+err.Error())
			return
		}
		sa, err := h.store.CreateSuperAdmin(ctx, req.SuperAdminEmail, req.SuperAdminName, hash)
		if err != nil {
			errResponse(c, http.StatusInternalServerError, "failed to create superadmin: "+err.Error())
			return
		}
		result["superadmin"] = sa
	}

	// Step 2: Create the first tenant
	t, err := h.store.CreateTenant(ctx, req.TenantSlug, req.TenantName, req.TenantDescription)
	if err != nil {
		errResponse(c, http.StatusConflict, "tenant slug already exists: "+err.Error())
		return
	}
	result["tenant"] = t

	// Step 3: Create the business admin for the tenant
	hash, err := h.hashPw(req.AdminPassword)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to hash admin password: "+err.Error())
		return
	}
	admin, err := h.store.CreateBusinessAdmin(ctx, t.ID, req.AdminEmail, req.AdminName, hash)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to create business admin: "+err.Error())
		return
	}
	result["admin"] = admin

	// Step 4: Create default tenant settings
	_ = h.store.UpsertTenantSettings(ctx, &models.TenantSettings{
		TenantID:           t.ID,
		DefaultLanguage:    req.DefaultLanguage,
		SupportedLanguages: req.SupportedLanguages,
		BrandColor:         req.BrandColor,
	})

	// Step 5: Seed default permissions for the new tenant
	_ = h.store.SeedDefaultPermissions(ctx, t.ID)

	result["setup_complete"] = true
	c.JSON(http.StatusCreated, result)
}

// CreateTenantOnly creates just a tenant + business admin (used when superadmin exists but no tenants).
type createTenantOnlyReq struct {
	TenantSlug        string `json:"tenant_slug" binding:"required"`
	TenantName        string `json:"tenant_name" binding:"required"`
	TenantDescription string `json:"tenant_description"`
	AdminEmail        string `json:"admin_email" binding:"required,email"`
	AdminPassword     string `json:"admin_password" binding:"required,min=6"`
	AdminName         string `json:"admin_name" binding:"required"`
	DefaultLanguage    string `json:"default_language"`
	SupportedLanguages []string `json:"supported_languages"`
	BrandColor         string `json:"brand_color"`
}

// CreateFirstTenant creates the first tenant when a superadmin already exists but no tenants.
// Requires superadmin authentication.
func (h *SetupHandler) CreateFirstTenant(c *gin.Context) {
	ctx := c.Request.Context()

	tenantCount, _ := h.store.CountTenants(ctx)
	if tenantCount > 0 {
		errResponse(c, http.StatusConflict, "tenants already exist; use the normal tenant creation endpoint")
		return
	}

	var req createTenantOnlyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	if req.DefaultLanguage == "" {
		req.DefaultLanguage = "en"
	}
	if len(req.SupportedLanguages) == 0 {
		req.SupportedLanguages = []string{"en"}
	}
	if req.BrandColor == "" {
		req.BrandColor = "#4f46e5"
	}

	t, err := h.store.CreateTenant(ctx, req.TenantSlug, req.TenantName, req.TenantDescription)
	if err != nil {
		errResponse(c, http.StatusConflict, "tenant slug already exists: "+err.Error())
		return
	}

	hash, err := auth.HashPassword(req.AdminPassword)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to hash admin password: "+err.Error())
		return
	}
	admin, err := h.store.CreateBusinessAdmin(ctx, t.ID, req.AdminEmail, req.AdminName, hash)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, "failed to create business admin: "+err.Error())
		return
	}

	_ = h.store.UpsertTenantSettings(ctx, &models.TenantSettings{
		TenantID:           t.ID,
		DefaultLanguage:    req.DefaultLanguage,
		SupportedLanguages: req.SupportedLanguages,
		BrandColor:         req.BrandColor,
	})
	_ = h.store.SeedDefaultPermissions(ctx, t.ID)

	c.JSON(http.StatusCreated, gin.H{"tenant": t, "admin": admin, "setup_complete": true})
}
