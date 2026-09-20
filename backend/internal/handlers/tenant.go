package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type TenantHandler struct {
	store *services.Store
}

func NewTenantHandler(store *services.Store) *TenantHandler {
	return &TenantHandler{store: store}
}

type createTenantReq struct {
	Slug        string `json:"slug" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

func (h *TenantHandler) List(c *gin.Context) {
	tenants, err := h.store.ListTenants(c.Request.Context())
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": tenants})
}

func (h *TenantHandler) Create(c *gin.Context) {
	var req createTenantReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	t, err := h.store.CreateTenant(c.Request.Context(), req.Slug, req.Name, req.Description)
	if err != nil {
		errResponse(c, http.StatusConflict, "slug already exists")
		return
	}
	c.JSON(http.StatusCreated, t)
}

func (h *TenantHandler) GetSettings(c *gin.Context) {
	tid := tenantID(c)
	ts, err := h.store.GetTenantSettings(c.Request.Context(), tid)
	if err != nil {
		notFoundOrErr(c, err, "settings not found")
		return
	}
	c.JSON(http.StatusOK, ts)
}

type updateSettingsReq struct {
	DefaultCurrencyCode string   `json:"default_currency_code"`
	DefaultLanguage     string   `json:"default_language"`
	SupportedLanguages  []string `json:"supported_languages"`
	BrandColor          string   `json:"brand_color"`
	LogoURL             string   `json:"logo_url"`
	LandingPageEnabled  *bool    `json:"landing_page_enabled"`
	LandingPageContent  *models.LandingPageContent `json:"landing_page_content"`
	AnonymousCheckout   *bool    `json:"anonymous_checkout"`
}

func (h *TenantHandler) UpdateSettings(c *gin.Context) {
	var req updateSettingsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	tid := tenantID(c)
	ts := &models.TenantSettings{
		TenantID:           tid,
		DefaultLanguage:    req.DefaultLanguage,
		SupportedLanguages: req.SupportedLanguages,
		BrandColor:         req.BrandColor,
		LogoURL:            req.LogoURL,
	}
	if req.DefaultCurrencyCode != "" {
		cur, err := h.store.GetCurrencyByCode(c.Request.Context(), req.DefaultCurrencyCode)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "unknown currency code")
			return
		}
		ts.DefaultCurrencyID = &cur.ID
	}
	// Load existing settings to preserve fields not included in the request
	existing, err := h.store.GetTenantSettings(c.Request.Context(), tid)
	if err == nil && existing != nil {
		if ts.DefaultCurrencyID == nil {
			ts.DefaultCurrencyID = existing.DefaultCurrencyID
		}
		if ts.DefaultLanguage == "" {
			ts.DefaultLanguage = existing.DefaultLanguage
		}
		if ts.SupportedLanguages == nil {
			ts.SupportedLanguages = existing.SupportedLanguages
		}
		if ts.BrandColor == "" {
			ts.BrandColor = existing.BrandColor
		}
		if ts.LogoURL == "" {
			ts.LogoURL = existing.LogoURL
		}
		// Preserve SEO/social fields from existing settings
		ts.MetaTitle = existing.MetaTitle
		ts.MetaDescription = existing.MetaDescription
		ts.OGImage = existing.OGImage
		ts.SiteURL = existing.SiteURL
		ts.SocialLinks = existing.SocialLinks
		// Preserve landing page settings unless explicitly provided
		if req.LandingPageEnabled != nil {
			ts.LandingPageEnabled = *req.LandingPageEnabled
		} else {
			ts.LandingPageEnabled = existing.LandingPageEnabled
		}
		if req.LandingPageContent != nil {
			ts.LandingPageContent = req.LandingPageContent
		} else {
			ts.LandingPageContent = existing.LandingPageContent
		}
		// Preserve anonymous checkout setting unless explicitly provided
		if req.AnonymousCheckout != nil {
			ts.AnonymousCheckout = *req.AnonymousCheckout
		} else {
			ts.AnonymousCheckout = existing.AnonymousCheckout
		}
	}
	if ts.DefaultLanguage == "" {
		ts.DefaultLanguage = "en"
	}
	if ts.SupportedLanguages == nil {
		ts.SupportedLanguages = []string{"en"}
	}
	if err := h.store.UpsertTenantSettings(c.Request.Context(), ts); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, ts)
}

// BootstrapBusinessAdmin: superadmin creates a tenant + its first business admin in one call.
type bootstrapReq struct {
	Slug        string `json:"slug" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	AdminEmail  string `json:"admin_email" binding:"required,email"`
	AdminPwd    string `json:"admin_password" binding:"required,min=6"`
	AdminName   string `json:"admin_name" binding:"required"`
}

func (h *TenantHandler) Bootstrap(c *gin.Context, hashPw func(string) (string, error)) {
	var req bootstrapReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	t, err := h.store.CreateTenant(c.Request.Context(), req.Slug, req.Name, req.Description)
	if err != nil {
		errResponse(c, http.StatusConflict, "slug already exists")
		return
	}
	hash, err := hashPw(req.AdminPwd)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	admin, err := h.store.CreateBusinessAdmin(c.Request.Context(), t.ID, req.AdminEmail, req.AdminName, hash)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	// default settings
	_ = h.store.UpsertTenantSettings(c.Request.Context(), &models.TenantSettings{
		TenantID: t.ID, DefaultLanguage: "en", SupportedLanguages: []string{"en"}, BrandColor: "#4f46e5",
	})
	c.JSON(http.StatusCreated, gin.H{"tenant": t, "admin": admin})
}

// Public tenant info (for frontstore to load branding).
func (h *TenantHandler) PublicInfo(c *gin.Context) {
	tid := tenantID(c)
	t, err := h.store.GetTenantByID(c.Request.Context(), tid)
	if err != nil {
		notFoundOrErr(c, err, "tenant not found")
		return
	}
	ts, _ := h.store.GetTenantSettings(c.Request.Context(), tid)
	c.JSON(http.StatusOK, gin.H{"tenant": t, "settings": ts})
}

// ===== Store Management (superadmin) =====

type updateTenantReq struct {
	Name           string  `json:"name" binding:"required"`
	Description    string  `json:"description"`
	ContactEmail   string  `json:"contact_email"`
	ContactPhone   string  `json:"contact_phone"`
	Country        string  `json:"country"`
	City           string  `json:"city"`
	Address        string  `json:"address"`
	Plan           string  `json:"plan"`
	CommissionRate float64 `json:"commission_rate"`
}

func (h *TenantHandler) Update(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	var req updateTenantReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Plan == "" {
		req.Plan = "standard"
	}
	t, err := h.store.UpdateTenant(c.Request.Context(), id, req.Name, req.Description,
		req.ContactEmail, req.ContactPhone, req.Country, req.City, req.Address, req.Plan, req.CommissionRate)
	if err != nil {
		notFoundOrErr(c, err, "tenant not found")
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *TenantHandler) SetActive(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.store.SetTenantActive(c.Request.Context(), id, req.IsActive); err != nil {
		notFoundOrErr(c, err, "tenant not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *TenantHandler) StoreStats(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	stats, err := h.store.StoreStats(c.Request.Context(), id)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *TenantHandler) GetByID(c *gin.Context) {
	id, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	t, err := h.store.GetTenantByID(c.Request.Context(), id)
	if err != nil {
		notFoundOrErr(c, err, "tenant not found")
		return
	}
	c.JSON(http.StatusOK, t)
}

// helper to parse path uuid
func pathUUID(c *gin.Context, key string) (uuid.UUID, bool) {
	s := c.Param(key)
	id, err := uuid.Parse(s)
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid id")
		return uuid.Nil, false
	}
	return id, true
}
