package handlers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/trucommerce/backend/internal/config"
	"github.com/trucommerce/backend/internal/services"
)

// PlatformHandler serves platform-wide (superadmin) endpoints: dashboard KPIs,
// developer/system settings, and cross-tenant data views.
type PlatformHandler struct {
	store     *services.Store
	cfg       *config.Config
	startedAt time.Time
	version   string
	commit    string
	buildDate string
}

func NewPlatformHandler(store *services.Store, cfg *config.Config, version, commit, buildDate string) *PlatformHandler {
	return &PlatformHandler{
		store:     store,
		cfg:       cfg,
		startedAt: time.Now(),
		version:   version,
		commit:    commit,
		buildDate: buildDate,
	}
}

// Stats returns aggregate KPIs across all tenants for the superadmin dashboard.
func (h *PlatformHandler) Stats(c *gin.Context) {
	stats, err := h.store.PlatformStats(c.Request.Context())
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, stats)
}

// DeveloperSettings returns the platform configuration (developer/system settings).
// Sensitive values (passwords, secrets) are masked.
func (h *PlatformHandler) DeveloperSettings(c *gin.Context) {
	cfg := h.cfg

	c.JSON(http.StatusOK, gin.H{
		"system": gin.H{
			"app_env":      cfg.AppEnv,
			"app_name":     cfg.AppName,
			"port":         cfg.Port,
			"version":      h.version,
			"commit":       h.commit,
			"build_date":   h.buildDate,
			"go_version":   runtime.Version(),
			"uptime":       time.Since(h.startedAt).Round(time.Second).String(),
			"started_at":   h.startedAt.UTC().Format(time.RFC3339),
			"num_cpu":      runtime.NumCPU(),
			"goroutines":   runtime.NumGoroutine(),
		},
		"logging": gin.H{
			"log_level":   cfg.LogLevel,
			"log_format":  cfg.LogFormat,
		},
		"database": gin.H{
			"max_conns":           cfg.DBMaxConns,
			"min_conns":           cfg.DBMinConns,
			"max_conn_lifetime":   cfg.DBMaxConnLifetime.String(),
			"max_conn_idle_time":  cfg.DBMaxConnIdleTime.String(),
		},
		"redis": gin.H{
			"addr":     cfg.RedisAddr,
			"db":       cfg.RedisDB,
			"has_password": cfg.RedisPassword != "",
		},
		"jwt": gin.H{
			"access_ttl":  cfg.JWTAccessTTL.String(),
			"refresh_ttl": cfg.JWTRefreshTTL.String(),
			"secret_set":  len(cfg.JWTSecret) > 0,
			"secret_len":  len(cfg.JWTSecret),
		},
		"cors": gin.H{
			"allowed_origins": cfg.CORSAllowedOrigins,
			"max_age":         cfg.CORSMaxAge.String(),
		},
		"http": gin.H{
			"read_timeout":     cfg.ReadTimeout.String(),
			"write_timeout":    cfg.WriteTimeout.String(),
			"idle_timeout":      cfg.IdleTimeout.String(),
			"shutdown_timeout": cfg.ShutdownTimeout.String(),
		},
		"rate_limiting": gin.H{
			"enabled":  cfg.RateLimitEnabled,
			"requests": cfg.RateLimitRequests,
			"window":   cfg.RateLimitWindow.String(),
			"burst":    cfg.RateLimitBurst,
		},
		"cookie": gin.H{
			"secure":    cfg.CookieSecure,
			"same_site": cfg.CookieSameSite,
			"domain":    cfg.CookieDomain,
		},
		"uploads": gin.H{
			"max_size":       cfg.UploadMaxSize,
			"allowed_types":  cfg.UploadAllowedTypes,
		},
		"smtp": gin.H{
			"host":       cfg.SMTPHost,
			"port":       cfg.SMTPPort,
			"user":       cfg.SMTPUser,
			"from":       cfg.SMTPFrom,
			"from_name":  cfg.SMTPFromName,
			"has_password": cfg.SMTPPassword != "",
			"enabled":     cfg.SMTPHost != "",
		},
		"payments": gin.H{
			"test_payments_enabled": cfg.EnableTestPayments,
			"razorpay_key_id":       cfg.RazorpayKeyID,
			"has_razorpay_secret":   cfg.RazorpayKeySecret != "",
		},
		"currency": gin.H{
			"cache_ttl": cfg.CurrencyCacheTTL.String(),
		},
	})
}

// HealthCheck returns system health status for the developer dashboard.
func (h *PlatformHandler) HealthCheck(c *gin.Context) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	c.JSON(http.StatusOK, gin.H{
		"status":     "ok",
		"uptime":     time.Since(h.startedAt).Round(time.Second).String(),
		"goroutines": runtime.NumGoroutine(),
		"memory": gin.H{
			"alloc_mb":       m.Alloc / 1024 / 1024,
			"total_alloc_mb": m.TotalAlloc / 1024 / 1024,
			"sys_mb":         m.Sys / 1024 / 1024,
			"gc_count":       m.NumGC,
		},
		"cpu": gin.H{
			"num_cpu": runtime.NumCPU(),
		},
	})
}
