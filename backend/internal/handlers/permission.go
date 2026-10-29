package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/middleware"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

type PermissionHandler struct {
	store *services.Store
}

func NewPermissionHandler(store *services.Store) *PermissionHandler {
	return &PermissionHandler{store: store}
}

// ListPermissions returns the full permission catalog.
func (h *PermissionHandler) ListPermissions(c *gin.Context) {
	perms, err := h.store.ListPermissions(c.Request.Context())
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": perms})
}

// ListRolePermissions returns all role-permission mappings for the tenant.
func (h *PermissionHandler) ListRolePermissions(c *gin.Context) {
	tid := tenantID(c)
	rps, err := h.store.ListRolePermissions(c.Request.Context(), tid)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": rps})
}

// GetRolePermissions returns permissions for a specific role within the tenant.
func (h *PermissionHandler) GetRolePermissions(c *gin.Context) {
	tid := tenantID(c)
	role := models.UserRole(c.Param("role"))
	switch role {
	case models.RoleBusinessAdmin, models.RoleStaff, models.RoleCustomer, models.RoleBranchManager, models.RoleDeliveryPartner:
		// valid
	default:
		errResponse(c, http.StatusBadRequest, "invalid role")
		return
	}
	rps, err := h.store.GetRolePermissions(c.Request.Context(), tid, role)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": rps})
}

type setRolePermissionsReq struct {
	PermissionIDs []uuid.UUID `json:"permission_ids"`
}

// SetRolePermissions bulk-replaces all permissions for a role within the tenant.
func (h *PermissionHandler) SetRolePermissions(c *gin.Context) {
	tid := tenantID(c)
	role := models.UserRole(c.Param("role"))
	switch role {
	case models.RoleBusinessAdmin, models.RoleStaff, models.RoleCustomer, models.RoleBranchManager, models.RoleDeliveryPartner:
		// valid
	default:
		errResponse(c, http.StatusBadRequest, "invalid role")
		return
	}
	var req setRolePermissionsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.store.SetRolePermissions(c.Request.Context(), tid, role, req.PermissionIDs); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true, "count": len(req.PermissionIDs)})
}

type togglePermissionReq struct {
	PermissionID uuid.UUID `json:"permission_id" binding:"required"`
	Granted      bool      `json:"granted"`
}

// TogglePermission grants or revokes a single permission for a role.
func (h *PermissionHandler) TogglePermission(c *gin.Context) {
	tid := tenantID(c)
	role := models.UserRole(c.Param("role"))
	switch role {
	case models.RoleBusinessAdmin, models.RoleStaff, models.RoleCustomer, models.RoleBranchManager, models.RoleDeliveryPartner:
		// valid
	default:
		errResponse(c, http.StatusBadRequest, "invalid role")
		return
	}
	var req togglePermissionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.store.SetRolePermission(c.Request.Context(), tid, role, req.PermissionID, req.Granted); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"updated": true})
}

// SeedDefaults seeds default permissions for the tenant if not already configured.
func (h *PermissionHandler) SeedDefaults(c *gin.Context) {
	tid := tenantID(c)
	if err := h.store.SeedDefaultPermissions(c.Request.Context(), tid); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"seeded": true})
}

// MyPermissions returns the permissions for the current authenticated user.
func (h *PermissionHandler) MyPermissions(c *gin.Context) {
	uid := userID(c)
	u, err := h.store.GetUserByID(c.Request.Context(), uid)
	if err != nil {
		errResponse(c, http.StatusNotFound, "user not found")
		return
	}
	role := u.Role
	// For superadmin, return all permissions
	if role == models.RoleSuperAdmin {
		perms, err := h.store.ListPermissions(c.Request.Context())
		if err != nil {
			errResponse(c, http.StatusInternalServerError, err.Error())
			return
		}
		codes := make([]string, len(perms))
		for i, p := range perms {
			codes[i] = p.Code
		}
		c.JSON(http.StatusOK, gin.H{"permissions": codes, "role": role})
		return
	}
	if u.TenantID == nil {
		c.JSON(http.StatusOK, gin.H{"permissions": []string{}, "role": role})
		return
	}
	codes, err := middleware.GetUserPermissionsForContext(c.Request.Context(), h.store, *u.TenantID, role)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"permissions": codes, "role": role})
}
