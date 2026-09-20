package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/auth"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

const (
	CtxTenantID  = "tenant_id"
	CtxTenantSlug = "tenant_slug"
	CtxUserID    = "user_id"
	CtxUserEmail = "user_email"
	CtxUserRole  = "user_role"
	CtxClaims    = "claims"
)

// ResolveTenant extracts the tenant slug from the path /t/:tenant/... and loads it.
// For platform-level (superadmin) routes that don't include :tenant, it allows passthrough.
func ResolveTenant(loader func(slug string) (*models.Tenant, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		// API routes look like /api/t/:tenant/...
		if !strings.HasPrefix(path, "/api/t/") {
			c.Next()
			return
		}
		// strip prefix and read first segment
		rest := strings.TrimPrefix(path, "/api/t/")
		parts := strings.SplitN(rest, "/", 2)
		if len(parts) == 0 || parts[0] == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "tenant slug required"})
			return
		}
		slug := parts[0]
		t, err := loader(slug)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
			return
		}
		if !t.IsActive {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "tenant inactive"})
			return
		}
		c.Set(CtxTenantID, t.ID)
		c.Set(CtxTenantSlug, t.Slug)
		c.Next()
	}
}

// RequireAuth validates the JWT bearer token.
func RequireAuth(svc *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		tokenStr := strings.TrimPrefix(h, "Bearer ")
		claims, err := svc.ParseAccessToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token", "detail": err.Error()})
			return
		}
		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxUserEmail, claims.Email)
		c.Set(CtxUserRole, claims.Role)
		if claims.TenantID != nil {
			c.Set(CtxTenantID, *claims.TenantID)
		}
		c.Set(CtxClaims, claims)
		c.Next()
	}
}

// OptionalAuth parses the JWT bearer token if present and sets user context.
// Unlike RequireAuth, it does not fail if no token is provided or the token is invalid.
// Does not set tenant_id (that's set by ResolveTenant from the path).
// Used for public routes that need to detect authenticated users (e.g., checkout with wallet).
func OptionalAuth(svc *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.Next()
			return
		}
		tokenStr := strings.TrimPrefix(h, "Bearer ")
		claims, err := svc.ParseAccessToken(tokenStr)
		if err != nil {
			c.Next()
			return
		}
		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxUserEmail, claims.Email)
		c.Set(CtxUserRole, claims.Role)
		c.Set(CtxClaims, claims)
		c.Next()
	}
}

// RequireRole allows only the listed roles.
func RequireRole(roles ...models.UserRole) gin.HandlerFunc {
	allowed := make(map[models.UserRole]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		role, exists := c.Get(CtxUserRole)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "no role in context"})
			return
		}
		r := role.(models.UserRole)
		if _, ok := allowed[r]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}

// RequireTenantMatch ensures the authenticated user belongs to the resolved tenant.
// Superadmin bypasses this.
func RequireTenantMatch() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(CtxUserRole)
		if role == models.RoleSuperAdmin {
			c.Next()
			return
		}
		tenantID, hasTenant := c.Get(CtxTenantID)
		if !hasTenant {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "tenant not resolved"})
			return
		}
		claimsVal, _ := c.Get(CtxClaims)
		claims := claimsVal.(*auth.Claims)
		if claims.TenantID == nil || *claims.TenantID != tenantID.(uuid.UUID) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "tenant mismatch"})
			return
		}
		c.Next()
	}
}

// RequirePermission checks that the authenticated user's role has the specified
// permission within the resolved tenant. Superadmin always passes.
// If no tenant-level permissions are configured for the role, the fallback
// behavior is to allow access (backward-compatible with existing role checks).
func RequirePermission(store *services.Store, permCode string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get(CtxUserRole)
		// Superadmin always has all permissions
		if role == models.RoleSuperAdmin {
			c.Next()
			return
		}

		// business_admin without explicit permissions gets all (backward compat)
		r := role.(models.UserRole)

		tenantIDVal, hasTenant := c.Get(CtxTenantID)
		if !hasTenant {
			// No tenant context — can't check permissions, fall through
			c.Next()
			return
		}
		tenantID := tenantIDVal.(uuid.UUID)

		// Check if any permissions are configured for this role in this tenant
		codes, err := store.GetUserPermissions(c.Request.Context(), tenantID, r)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to load permissions"})
			return
		}

		// If no permissions are configured for this role, use fallback:
		// business_admin gets full access, staff gets read access
		if len(codes) == 0 {
			if r == models.RoleBusinessAdmin {
				c.Next()
				return
			}
			// Staff fallback: allow read-only permissions (codes ending with .view)
			if strings.HasSuffix(permCode, ".view") {
				c.Next()
				return
			}
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions", "required": permCode})
			return
		}

		// Check if the required permission is in the user's set
		for _, code := range codes {
			if code == permCode {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions", "required": permCode})
	}
}

// GetUserPermissionsForContext is a helper to fetch permissions for the current user context.
// Used by the /me/permissions endpoint.
func GetUserPermissionsForContext(ctx context.Context, store *services.Store, tenantID uuid.UUID, role models.UserRole) ([]string, error) {
	if role == models.RoleSuperAdmin {
		// Return all permission codes
		perms, err := store.ListPermissions(ctx)
		if err != nil {
			return nil, err
		}
		codes := make([]string, len(perms))
		for i, p := range perms {
			codes[i] = p.Code
		}
		return codes, nil
	}
	return store.GetUserPermissions(ctx, tenantID, role)
}
