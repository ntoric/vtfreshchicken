package handlers

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/middleware"
	"github.com/trucommerce/backend/internal/models"
)

func tenantID(c *gin.Context) uuid.UUID {
	v, _ := c.Get(middleware.CtxTenantID)
	return v.(uuid.UUID)
}

func userID(c *gin.Context) uuid.UUID {
	v, _ := c.Get(middleware.CtxUserID)
	return v.(uuid.UUID)
}

func userRole(c *gin.Context) models.UserRole {
	v, _ := c.Get(middleware.CtxUserRole)
	return v.(models.UserRole)
}

// branchFilter resolves the effective branch scope for admin endpoints.
// Branch-bound users (branch_manager / staff whose token carries a branch_id)
// are always limited to their own branch. Admins may optionally scope via the
// X-Branch-Id header or ?branch_id= query parameter (the branch switcher).
// Returns nil when the request is unscoped (all branches).
func branchFilter(c *gin.Context) *uuid.UUID {
	if v, ok := c.Get(middleware.CtxBranchID); ok {
		if id, isUUID := v.(uuid.UUID); isUUID {
			return &id
		}
	}
	raw := c.GetHeader("X-Branch-Id")
	if raw == "" {
		raw = c.Query("branch_id")
	}
	if raw == "" || raw == "all" {
		return nil
	}
	if id, err := uuid.Parse(raw); err == nil {
		return &id
	}
	return nil
}

// branchRestricted reports whether the caller is bound to a specific branch —
// such callers must not see or mutate other branches' data.
func branchRestricted(c *gin.Context) bool {
	_, ok := c.Get(middleware.CtxBranchID)
	return ok
}

func errResponse(c *gin.Context, code int, msg string) {
	c.JSON(code, gin.H{"error": msg})
}

func notFoundOrErr(c *gin.Context, err error, notFoundMsg string) {
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, sql.ErrNoRows) {
		errResponse(c, http.StatusNotFound, notFoundMsg)
		return
	}
	errResponse(c, http.StatusInternalServerError, err.Error())
}
