package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/auth"
	"github.com/trucommerce/backend/internal/middleware"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type AuthHandler struct {
	store *services.Store
	auth  *auth.Service
}

func NewAuthHandler(store *services.Store, authSvc *auth.Service) *AuthHandler {
	return &AuthHandler{store: store, auth: authSvc}
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type registerReq struct {
	Email            string `json:"email" binding:"required,email"`
	Password         string `json:"password" binding:"required,min=6"`
	FullName         string `json:"full_name" binding:"required"`
	Phone            string `json:"phone"`
	MarketingConsent bool   `json:"marketing_consent"`
}

type refreshReq struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type authResp struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         *models.User `json:"user"`
	TenantName   string       `json:"tenant_name,omitempty"`
	TenantSlug   string       `json:"tenant_slug,omitempty"`
}

// Login works for superadmin (no tenant) and tenant users (tenant resolved from path).
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	// Determine tenant scope: if tenant resolved in context, scope to it; else superadmin.
	var tid *uuid.UUID
	if v, ok := c.Get(middleware.CtxTenantID); ok {
		t := v.(uuid.UUID)
		tid = &t
	}

	u, err := h.store.GetUserByEmail(c.Request.Context(), tid, req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			errResponse(c, http.StatusUnauthorized, "invalid credentials")
			return
		}
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if !u.IsActive {
		errResponse(c, http.StatusForbidden, "account disabled")
		return
	}
	if err := auth.VerifyPassword(u.PasswordHash, req.Password); err != nil {
		errResponse(c, http.StatusUnauthorized, "invalid credentials")
		return
	}
	// If logging in without tenant context but user is tenant-scoped, reject
	if tid == nil && u.TenantID != nil {
		errResponse(c, http.StatusUnauthorized, "use tenant-scoped login URL")
		return
	}
	h.store.UpdateLastLoginAt(c.Request.Context(), u.ID)
	h.issueTokens(c, u)
}

func (h *AuthHandler) issueTokens(c *gin.Context, u *models.User) {
	access, err := h.auth.IssueAccessToken(u)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	refresh, err := h.auth.IssueRefreshToken(u)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp := authResp{AccessToken: access, RefreshToken: refresh, User: u}
	// Include the tenant name/slug for tenant-scoped users so the frontend
	// can display the store name without an extra API call.
	if u.TenantID != nil {
		if t, err := h.store.GetTenantByID(c.Request.Context(), *u.TenantID); err == nil {
			resp.TenantName = t.Name
			resp.TenantSlug = t.Slug
		}
	}
	c.JSON(http.StatusOK, resp)
}

// Register creates a customer account within the resolved tenant.
func (h *AuthHandler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	tid := tenantID(c)
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	u, err := h.store.CreateCustomer(c.Request.Context(), tid, req.Email, req.FullName, hash)
	if err != nil {
		errResponse(c, http.StatusConflict, "email already registered")
		return
	}
	// Set optional profile fields
	if req.Phone != "" || req.MarketingConsent {
		_, _ = h.store.Pool.Exec(c.Request.Context(),
			`UPDATE users SET phone=$1, marketing_consent=$2 WHERE id=$3`,
			req.Phone, req.MarketingConsent, u.ID)
		u.Phone = req.Phone
		u.MarketingConsent = req.MarketingConsent
	}
	// Link any anonymous/guest orders placed with the same email so the new
	// customer sees their prior purchase history. Also link by session cookie
	// in case the guest is registering from the same browser session.
	_, _ = h.store.LinkOrdersToUserByEmail(c.Request.Context(), tid, u.ID, req.Email)
	if sessionID := getSessionID(c); sessionID != "" {
		_, _ = h.store.LinkOrdersToUser(c.Request.Context(), tid, u.ID, sessionID)
	}
	h.issueTokens(c, u)
}

// RegisterFromOrder creates a customer account from a completed guest order.
// It registers the customer and links all guest orders from the same session
// to the new account so the customer can see their order history.
func (h *AuthHandler) RegisterFromOrder(c *gin.Context) {
	var req struct {
		Email            string `json:"email" binding:"required,email"`
		Password         string `json:"password" binding:"required,min=6"`
		FullName         string `json:"full_name" binding:"required"`
		Phone            string `json:"phone"`
		MarketingConsent bool   `json:"marketing_consent"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	tid := tenantID(c)
	sessionID := getSessionID(c)
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	u, err := h.store.CreateCustomer(c.Request.Context(), tid, req.Email, req.FullName, hash)
	if err != nil {
		errResponse(c, http.StatusConflict, "email already registered")
		return
	}
	// Set optional profile fields
	if req.Phone != "" || req.MarketingConsent {
		_, _ = h.store.Pool.Exec(c.Request.Context(),
			`UPDATE users SET phone=$1, marketing_consent=$2 WHERE id=$3`,
			req.Phone, req.MarketingConsent, u.ID)
		u.Phone = req.Phone
		u.MarketingConsent = req.MarketingConsent
	}
	// Link guest orders from this session to the new account
	if sessionID != "" {
		_, _ = h.store.LinkOrdersToUser(c.Request.Context(), tid, u.ID, sessionID)
	}
	// Also link any anonymous orders placed with the same email (covers orders
	// from other sessions/devices with the same guest email).
	_, _ = h.store.LinkOrdersToUserByEmail(c.Request.Context(), tid, u.ID, req.Email)
	h.issueTokens(c, u)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	// We need the user id; parse from old access token if present (even if expired we can't).
	// Instead, look up user by refresh token pattern is expensive; require user_id in body.
	var body struct {
		refreshReq
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	uid, err := uuid.Parse(body.UserID)
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid user_id")
		return
	}
	if err := h.auth.ValidateRefreshToken(uid, body.RefreshToken); err != nil {
		errResponse(c, http.StatusUnauthorized, err.Error())
		return
	}
	u, err := h.store.GetUserByID(c.Request.Context(), uid)
	if err != nil {
		errResponse(c, http.StatusUnauthorized, "user not found")
		return
	}
	_ = h.auth.RevokeRefreshToken(uid, body.RefreshToken)
	h.issueTokens(c, u)
}

func (h *AuthHandler) Me(c *gin.Context) {
	uid := userID(c)
	u, err := h.store.GetUserByID(c.Request.Context(), uid)
	if err != nil {
		notFoundOrErr(c, err, "user not found")
		return
	}
	c.JSON(http.StatusOK, u)
}

// CreateBusinessAdmin (superadmin or business_admin creates a tenant admin/staff).
type createStaffReq struct {
	Email    string          `json:"email" binding:"required,email"`
	Password string          `json:"password" binding:"required,min=6"`
	FullName string          `json:"full_name" binding:"required"`
	Role     models.UserRole `json:"role" binding:"required"`
}

func (h *AuthHandler) CreateStaff(c *gin.Context) {
	var req createStaffReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Role != models.RoleBusinessAdmin && req.Role != models.RoleStaff {
		errResponse(c, http.StatusBadRequest, "role must be business_admin or staff")
		return
	}
	tid := tenantID(c)
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	var u *models.User
	if req.Role == models.RoleBusinessAdmin {
		u, err = h.store.CreateBusinessAdmin(c.Request.Context(), tid, req.Email, req.FullName, hash)
	} else {
		u, err = h.store.CreateCustomer(c.Request.Context(), tid, req.Email, req.FullName, hash)
		// staff uses customer row but with staff role; update role
		if err == nil {
			_, _ = h.store.Pool.Exec(c.Request.Context(), `UPDATE users SET role='staff' WHERE id=$1`, u.ID)
			u.Role = models.RoleStaff
		}
	}
	if err != nil {
		errResponse(c, http.StatusConflict, err.Error())
		return
	}
	c.JSON(http.StatusCreated, u)
}

func (h *AuthHandler) ListUsers(c *gin.Context) {
	tid := tenantID(c)
	users, err := h.store.ListTenantUsers(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": users})
}

// ---------------- User management (admin) ----------------

func (h *AuthHandler) GetUser(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	u, err := h.store.GetTenantUser(c.Request.Context(), tenantID(c), uid)
	if err != nil {
		notFoundOrErr(c, err, "user not found")
		return
	}
	c.JSON(http.StatusOK, u)
}

type updateUserReq struct {
	FullName   string `json:"full_name" binding:"required"`
	Phone      string `json:"phone"`
	Role       string `json:"role"`
	AdminNotes string `json:"admin_notes"`
	IsActive   bool   `json:"is_active"`
}

func (h *AuthHandler) UpdateUser(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	var req updateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	// Validate role if provided
	if req.Role != "" {
		switch models.UserRole(req.Role) {
		case models.RoleCustomer, models.RoleStaff, models.RoleBusinessAdmin:
			// allowed
		default:
			errResponse(c, http.StatusBadRequest, "invalid role")
			return
		}
	} else {
		req.Role = string(models.RoleStaff)
	}
	u, err := h.store.UpdateUser(c.Request.Context(), tid, uid, req.FullName, req.Phone, req.Role, req.AdminNotes, req.IsActive)
	if err != nil {
		notFoundOrErr(c, err, "user not found")
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *AuthHandler) SetUserActive(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
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
	if err := h.store.SetUserActive(c.Request.Context(), tenantID(c), uid, req.IsActive); err != nil {
		notFoundOrErr(c, err, "user not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	var req struct {
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.ResetUserPassword(c.Request.Context(), tenantID(c), uid, hash); err != nil {
		notFoundOrErr(c, err, "user not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *AuthHandler) DeleteUser(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	// Prevent self-deletion
	if uid == userID(c) {
		errResponse(c, http.StatusBadRequest, "cannot delete your own account")
		return
	}
	if err := h.store.DeleteUserAdmin(c.Request.Context(), tenantID(c), uid); err != nil {
		notFoundOrErr(c, err, "user not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *AuthHandler) UserStats(c *gin.Context) {
	stats, err := h.store.UserStats(c.Request.Context(), tenantID(c))
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

// ---------------- Platform user management (superadmin) ----------------

func (h *AuthHandler) ListAllUsers(c *gin.Context) {
	users, err := h.store.ListAllUsers(c.Request.Context())
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": users})
}

// ---------------- Customer management (admin) ----------------

func (h *AuthHandler) ListCustomers(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")
	status := c.Query("status")

	f := services.CustomerFilter{TenantID: tid, Limit: limit, Offset: offset}
	if search != "" {
		f.Search = &search
	}
	if status == "active" {
		v := true
		f.IsActive = &v
	} else if status == "disabled" {
		v := false
		f.IsActive = &v
	}

	items, total, err := h.store.ListCustomers(c.Request.Context(), f)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "limit": limit, "offset": offset})
}

func (h *AuthHandler) GetCustomer(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	cd, err := h.store.GetCustomerDetail(c.Request.Context(), tenantID(c), uid)
	if err != nil {
		notFoundOrErr(c, err, "customer not found")
		return
	}
	c.JSON(http.StatusOK, cd)
}

type updateCustomerReq struct {
	FullName         string `json:"full_name" binding:"required"`
	Phone            string `json:"phone"`
	IsActive         bool   `json:"is_active"`
	MarketingConsent bool   `json:"marketing_consent"`
	AdminNotes       string `json:"admin_notes"`
}

func (h *AuthHandler) UpdateCustomer(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	var req updateCustomerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.store.UpdateCustomer(c.Request.Context(), tenantID(c), uid,
		req.FullName, req.Phone, req.IsActive, req.MarketingConsent, req.AdminNotes); err != nil {
		notFoundOrErr(c, err, "customer not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *AuthHandler) DeleteCustomer(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if err := h.store.DeleteCustomerAdmin(c.Request.Context(), tenantID(c), uid); err != nil {
		notFoundOrErr(c, err, "customer not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *AuthHandler) CustomerStats(c *gin.Context) {
	dr := services.DateRangeFilter{From: c.Query("from"), To: c.Query("to")}
	stats, err := h.store.CustomerStats(c.Request.Context(), tenantID(c), dr)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

// ExportMyData — GDPR Art. 15 (Right of access) & Art. 20 (Data portability).
// Returns all personal data associated with the authenticated user as JSON.
func (h *AuthHandler) ExportMyData(c *gin.Context) {
	uid := userID(c)
	data, err := h.store.ExportUserData(c.Request.Context(), uid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.Header("Content-Disposition", `attachment; filename="my-data-export.json"`)
	c.JSON(http.StatusOK, data)
}

// DeleteMyAccount — GDPR Art. 17 (Right to erasure / "right to be forgotten").
// Anonymizes and deactivates the authenticated user's account.
// Requires password confirmation for security.
func (h *AuthHandler) DeleteMyAccount(c *gin.Context) {
	uid := userID(c)
	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "password is required")
		return
	}

	// Verify password before deletion
	u, err := h.store.GetUserByID(c.Request.Context(), uid)
	if err != nil {
		errResponse(c, http.StatusNotFound, "user not found")
		return
	}
	if err := auth.VerifyPassword(u.PasswordHash, req.Password); err != nil {
		errResponse(c, http.StatusForbidden, "incorrect password")
		return
	}

	// Prevent superadmin/business_admin from self-deleting via this endpoint
	if u.Role == models.RoleSuperAdmin || u.Role == models.RoleBusinessAdmin {
		errResponse(c, http.StatusForbidden, "admin accounts cannot be self-deleted. Please contact support.")
		return
	}

	if err := h.store.DeleteUserAccount(c.Request.Context(), uid); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":   "Your account has been deleted and your personal data anonymized.",
		"deleted":   true,
		"user_id":   uid,
		"timestamp": c.Request.Context().Value("timestamp"),
	})
}
