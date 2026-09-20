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
