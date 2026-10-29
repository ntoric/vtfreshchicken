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
	Email     string          `json:"email" binding:"required,email"`
	Password  string          `json:"password" binding:"required,min=6"`
	FullName  string          `json:"full_name" binding:"required"`
	Role      models.UserRole `json:"role" binding:"required"`
	BranchID  string          `json:"branch_id"`  // optional — binds staff/branch_manager to a branch
	BranchIDs []string        `json:"branch_ids"` // delivery_partner: allocated branches (>=1 required)
}

func (h *AuthHandler) CreateStaff(c *gin.Context) {
	var req createStaffReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Role != models.RoleBusinessAdmin && req.Role != models.RoleStaff && req.Role != models.RoleBranchManager && req.Role != models.RoleDeliveryPartner {
		errResponse(c, http.StatusBadRequest, "role must be business_admin, branch_manager, staff or delivery_partner")
		return
	}
	tid := tenantID(c)

	// Merge branch_id + branch_ids into a validated allocation list.
	var branchAlloc []uuid.UUID
	seenBranch := map[uuid.UUID]bool{}
	for _, raw := range append(req.BranchIDs, req.BranchID) {
		if raw == "" {
			continue
		}
		bid, err := uuid.Parse(raw)
		if err != nil {
			errResponse(c, http.StatusBadRequest, "invalid branch_id")
			return
		}
		if seenBranch[bid] {
			continue
		}
		if _, bErr := h.store.GetBranch(c.Request.Context(), tid, bid); bErr != nil {
			errResponse(c, http.StatusBadRequest, "branch not found")
			return
		}
		seenBranch[bid] = true
		branchAlloc = append(branchAlloc, bid)
	}
	if req.Role == models.RoleDeliveryPartner && len(branchAlloc) == 0 {
		errResponse(c, http.StatusBadRequest, "delivery partners need at least one allocated branch")
		return
	}
	// Branch-bound staff can only create users inside their own branch, and
	// cannot create store-wide roles.
	if branchRestricted(c) {
		if req.Role == models.RoleBusinessAdmin {
			errResponse(c, http.StatusForbidden, "branch-scoped users cannot create business admins")
			return
		}
		if scope := branchFilter(c); scope != nil {
			if len(branchAlloc) == 0 {
				branchAlloc = []uuid.UUID{*scope}
			} else {
				inScope := false
				for _, b := range branchAlloc {
					if b == *scope {
						inScope = true
						break
					}
				}
				if !inScope {
					errResponse(c, http.StatusForbidden, "cannot assign users to other branches")
					return
				}
			}
		}
	}
	// users.branch_id keeps the primary branch (first allocation) — staff and
	// branch_manager use it directly; for partners it mirrors the allocation.
	var branchID *uuid.UUID
	if len(branchAlloc) > 0 {
		branchID = &branchAlloc[0]
	}

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
		// staff/branch_manager/delivery_partner uses customer row but with their role; update role + branch
		if err == nil {
			_, _ = h.store.Pool.Exec(c.Request.Context(), `UPDATE users SET role=$2, branch_id=$3 WHERE id=$1`, u.ID, req.Role, branchID)
			u.Role = req.Role
			u.BranchID = branchID
		}
	}
	if err != nil {
		errResponse(c, http.StatusConflict, err.Error())
		return
	}
	if req.Role == models.RoleDeliveryPartner {
		if err := h.store.SetDeliveryPartnerBranches(c.Request.Context(), tid, u.ID, branchAlloc); err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
		u.BranchIDs = branchAlloc
	}
	c.JSON(http.StatusCreated, u)
}

func (h *AuthHandler) ListUsers(c *gin.Context) {
	tid := tenantID(c)
	limit, offset := pagingParams(c)
	users, total, err := h.store.ListTenantUsersPaged(c.Request.Context(), tid, branchFilter(c), c.Query("role"), c.Query("search"), limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": users, "total": total, "limit": limit, "offset": offset})
}

// ---------------- User management (admin) ----------------

// userBranchAllowed reports whether a branch-bound caller may access the
// target user — they can only reach users assigned to their own branch.
func (h *AuthHandler) userBranchAllowed(c *gin.Context, uid uuid.UUID) bool {
	if !branchRestricted(c) {
		return true
	}
	scope := branchFilter(c)
	if scope == nil {
		return true
	}
	u, err := h.store.GetTenantUser(c.Request.Context(), tenantID(c), uid)
	if err != nil || u == nil {
		return false
	}
	return u.BranchID != nil && *u.BranchID == *scope
}

func (h *AuthHandler) GetUser(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if !h.userBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "user not found")
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
	FullName   string    `json:"full_name" binding:"required"`
	Phone      string    `json:"phone"`
	Role       string    `json:"role"`
	AdminNotes string    `json:"admin_notes"`
	IsActive   bool      `json:"is_active"`
	BranchID   *string   `json:"branch_id"`  // nil = keep; "" = clear; uuid = assign
	BranchIDs  *[]string `json:"branch_ids"` // delivery_partner: replaces branch allocation when present
}

func (h *AuthHandler) UpdateUser(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	tid := tenantID(c)
	if !h.userBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "user not found")
		return
	}
	var req updateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	// Validate role if provided
	if req.Role != "" {
		switch models.UserRole(req.Role) {
		case models.RoleCustomer, models.RoleStaff, models.RoleBusinessAdmin, models.RoleBranchManager, models.RoleDeliveryPartner:
			// allowed
		default:
			errResponse(c, http.StatusBadRequest, "invalid role")
			return
		}
	} else {
		req.Role = string(models.RoleStaff)
	}
	// Branch assignment: when the key is present, "" clears and a uuid assigns.
	// When absent, the user's existing branch is preserved.
	var branchID *uuid.UUID
	if req.BranchID != nil {
		if *req.BranchID != "" {
			bid, perr := uuid.Parse(*req.BranchID)
			if perr != nil {
				errResponse(c, http.StatusBadRequest, "invalid branch_id")
				return
			}
			if _, bErr := h.store.GetBranch(c.Request.Context(), tid, bid); bErr != nil {
				errResponse(c, http.StatusBadRequest, "branch not found")
				return
			}
			branchID = &bid
		}
	} else {
		if existing, gErr := h.store.GetTenantUser(c.Request.Context(), tid, uid); gErr == nil {
			branchID = existing.BranchID
		}
	}

	// Delivery partners allocate branches via branch_ids (or branch_id as a
	// single allocation). They must end up with at least one allocated branch.
	var partnerAlloc []uuid.UUID
	if req.Role == string(models.RoleDeliveryPartner) {
		switch {
		case req.BranchIDs != nil:
			for _, raw := range *req.BranchIDs {
				if raw == "" {
					continue
				}
				bid, perr := uuid.Parse(raw)
				if perr != nil {
					errResponse(c, http.StatusBadRequest, "invalid branch_id")
					return
				}
				if _, bErr := h.store.GetBranch(c.Request.Context(), tid, bid); bErr != nil {
					errResponse(c, http.StatusBadRequest, "branch not found")
					return
				}
				partnerAlloc = append(partnerAlloc, bid)
			}
		case req.BranchID != nil && *req.BranchID != "":
			partnerAlloc = []uuid.UUID{*branchID}
		default:
			var gErr error
			partnerAlloc, gErr = h.store.GetDeliveryPartnerBranchIDs(c.Request.Context(), tid, uid)
			if gErr != nil {
				errResponse(c, http.StatusInternalServerError, gErr.Error())
				return
			}
		}
		if len(partnerAlloc) == 0 {
			errResponse(c, http.StatusBadRequest, "delivery partners need at least one allocated branch")
			return
		}
		branchID = &partnerAlloc[0]
	}

	u, err := h.store.UpdateUser(c.Request.Context(), tid, uid, req.FullName, req.Phone, req.Role, req.AdminNotes, req.IsActive, branchID)
	if err != nil {
		notFoundOrErr(c, err, "user not found")
		return
	}
	if req.Role == string(models.RoleDeliveryPartner) {
		if err := h.store.SetDeliveryPartnerBranches(c.Request.Context(), tid, uid, partnerAlloc); err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
		u.BranchIDs = partnerAlloc
	} else {
		// Role is not (or no longer) delivery_partner — drop any allocations.
		_ = h.store.SetDeliveryPartnerBranches(c.Request.Context(), tid, uid, nil)
	}
	c.JSON(http.StatusOK, u)
}

func (h *AuthHandler) SetUserActive(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if !h.userBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "user not found")
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
	if !h.userBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "user not found")
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
	if !h.userBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "user not found")
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
	stats, err := h.store.UserStats(c.Request.Context(), tenantID(c), branchFilter(c))
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

	f := services.CustomerFilter{TenantID: tid, Limit: limit, Offset: offset, BranchID: branchFilter(c)}
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

// customerBranchAllowed reports whether a branch-bound caller may access the
// customer — they can only reach customers who have ordered from their branch.
func (h *AuthHandler) customerBranchAllowed(c *gin.Context, uid uuid.UUID) bool {
	if !branchRestricted(c) {
		return true
	}
	scope := branchFilter(c)
	if scope == nil {
		return true
	}
	ok, err := h.store.CustomerInBranch(c.Request.Context(), tenantID(c), uid, *scope)
	return err == nil && ok
}

func (h *AuthHandler) GetCustomer(c *gin.Context) {
	uid, ok := pathUUID(c, "id")
	if !ok {
		return
	}
	if !h.customerBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "customer not found")
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
	if !h.customerBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "customer not found")
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
	if !h.customerBranchAllowed(c, uid) {
		errResponse(c, http.StatusNotFound, "customer not found")
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
	stats, err := h.store.CustomerStats(c.Request.Context(), tenantID(c), dr, branchFilter(c))
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
