package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// Application
	AppEnv     string
	AppName    string
	AppBaseURL string
	Port       string

	// Logging
	LogLevel  string
	LogFormat string // "text" or "json"

	// PostgreSQL
	PostgresDSN       string
	DBMaxConns        int32
	DBMinConns        int32
	DBMaxConnLifetime time.Duration
	DBMaxConnIdleTime time.Duration

	// Redis
	RedisAddr     string
	RedisPassword string
	RedisDB       int

	// JWT / Auth
	JWTSecret           []byte
	JWTAccessTTL        time.Duration
	JWTRefreshTTL       time.Duration
	SeedSuperAdminEmail string
	SeedSuperAdminPwd   string

	// Single-store resolution
	StoreSlug string // optional: pin the store to a specific tenant slug

	// CORS
	CORSAllowedOrigins []string
	CORSMaxAge         time.Duration

	// HTTP Server
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	ShutdownTimeout   time.Duration

	// Rate Limiting
	RateLimitEnabled       bool
	RateLimitRequests      int // requests per window
	RateLimitWindow        time.Duration
	RateLimitBurst         int

	// Cookie / Session
	CookieSecure   bool
	CookieSameSite string // "strict", "lax", "none"
	CookieDomain   string

	// File Uploads
	UploadMaxSize      int64 // bytes
	UploadAllowedTypes []string

	// SMTP / Email
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string
	SMTPFromName string

	// Payment Gateways
	RazorpayKeyID     string
	RazorpayKeySecret string

	// Currency cache
	CurrencyCacheTTL time.Duration

	// Feature flags
	EnableTestPayments bool
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	c := &Config{
		// Application
		AppEnv:     getEnv("APP_ENV", "development"),
		AppName:    getEnv("APP_NAME", "trucommerce"),
		AppBaseURL: getEnv("APP_BASE_URL", "http://localhost:18080"),
		Port:       getEnv("PORT", "8080"),

		// Logging
		LogLevel:  getEnv("LOG_LEVEL", "info"),
		LogFormat: getEnv("LOG_FORMAT", "text"),

		// PostgreSQL
		PostgresDSN: getEnv("POSTGRES_DSN", "postgres://trucommerce:trucommerce@localhost:5432/trucommerce?sslmode=disable"),

		// Redis
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvInt("REDIS_DB", 0),

		// JWT / Auth
		JWTSecret:           []byte(getEnv("JWT_SECRET", "dev-secret-change-me")),
		SeedSuperAdminEmail: getEnv("SEED_SUPERADMIN_EMAIL", ""),
		SeedSuperAdminPwd:   getEnv("SEED_SUPERADMIN_PASSWORD", ""),

		// Single-store resolution
		StoreSlug: getEnv("STORE_SLUG", ""),

		// CORS
		CORSMaxAge: getEnvDuration("CORS_MAX_AGE", "12h"),

		// HTTP Server
		ReadTimeout:     getEnvDuration("HTTP_READ_TIMEOUT", "30s"),
		WriteTimeout:    getEnvDuration("HTTP_WRITE_TIMEOUT", "30s"),
		IdleTimeout:     getEnvDuration("HTTP_IDLE_TIMEOUT", "120s"),
		ShutdownTimeout: getEnvDuration("SHUTDOWN_TIMEOUT", "15s"),

		// Rate Limiting
		RateLimitEnabled:  getEnvBool("RATE_LIMIT_ENABLED", false),
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitWindow:   getEnvDuration("RATE_LIMIT_WINDOW", "1m"),
		RateLimitBurst:    getEnvInt("RATE_LIMIT_BURST", 20),

		// Cookie / Session
		CookieSecure:   getEnvBool("COOKIE_SECURE", false),
		CookieSameSite: getEnv("COOKIE_SAME_SITE", "lax"),
		CookieDomain:   getEnv("COOKIE_DOMAIN", ""),

		// File Uploads
		UploadMaxSize: getEnvInt64("UPLOAD_MAX_SIZE", 10*1024*1024), // 10 MB

		// SMTP / Email
		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnvInt("SMTP_PORT", 587),
		SMTPUser:     getEnv("SMTP_USER", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", ""),
		SMTPFromName: getEnv("SMTP_FROM_NAME", "TruCommerce"),

		// Payment Gateways
		RazorpayKeyID:     getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret: getEnv("RAZORPAY_KEY_SECRET", ""),

		// Currency cache
		CurrencyCacheTTL: getEnvDuration("CURRENCY_CACHE_TTL", "5m"),

		// Feature flags
		EnableTestPayments: getEnvBool("ENABLE_TEST_PAYMENTS", true),
	}

	// Parse JWT TTLs
	var err error
	c.JWTAccessTTL, err = getEnvDurationErr("JWT_ACCESS_TTL", "15m")
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_TTL: %w", err)
	}
	c.JWTRefreshTTL, err = getEnvDurationErr("JWT_REFRESH_TTL", "720h")
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_TTL: %w", err)
	}

	// Parse DB pool settings
	c.DBMaxConns = int32(getEnvInt("DB_MAX_CONNS", 20))
	c.DBMinConns = int32(getEnvInt("DB_MIN_CONNS", 2))
	c.DBMaxConnLifetime, err = getEnvDurationErr("DB_MAX_CONN_LIFETIME", "1h")
	if err != nil {
		return nil, fmt.Errorf("invalid DB_MAX_CONN_LIFETIME: %w", err)
	}
	c.DBMaxConnIdleTime, err = getEnvDurationErr("DB_MAX_CONN_IDLE_TIME", "15m")
	if err != nil {
		return nil, fmt.Errorf("invalid DB_MAX_CONN_IDLE_TIME: %w", err)
	}

	// Parse CORS origins
	origins := strings.Split(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:13000,http://localhost:5173,http://127.0.0.1:13000,http://127.0.0.1:5173"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	c.CORSAllowedOrigins = origins

	// Parse allowed upload types
	allowedTypes := strings.Split(getEnv("UPLOAD_ALLOWED_TYPES", "image/jpeg,image/png,image/webp,image/gif"), ",")
	for i := range allowedTypes {
		allowedTypes[i] = strings.TrimSpace(allowedTypes[i])
	}
	c.UploadAllowedTypes = allowedTypes

	// Validation
	if err := c.validate(); err != nil {
		return nil, err
	}

	return c, nil
}

// validate ensures critical configuration values are set correctly.
func (c *Config) validate() error {
	if c.IsProd() {
		if string(c.JWTSecret) == "dev-secret-change-me" || len(c.JWTSecret) < 32 {
			return fmt.Errorf("JWT_SECRET must be set to a strong value (>=32 chars) in production")
		}
		if c.CookieSecure == false {
			return fmt.Errorf("COOKIE_SECURE must be true in production")
		}
		if c.EnableTestPayments {
			return fmt.Errorf("ENABLE_TEST_PAYMENTS must be false in production")
		}
	}
	if c.RateLimitBurst < 1 {
		return fmt.Errorf("RATE_LIMIT_BURST must be >= 1")
	}
	if c.RateLimitRequests < 1 {
		return fmt.Errorf("RATE_LIMIT_REQUESTS must be >= 1")
	}
	return nil
}

func (c *Config) IsProd() bool  { return c.AppEnv == "production" }
func (c *Config) IsDev() bool   { return c.AppEnv == "development" }
func (c *Config) IsStaging() bool { return c.AppEnv == "staging" }

// LogEnabled returns true if the given log level should be emitted.
func (c *Config) LogLevelValue() string { return c.LogLevel }

// --- helpers ---

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

func getEnvDuration(key, fallback string) time.Duration {
	d, _ := getEnvDurationErr(key, fallback)
	return d
}

func getEnvDurationErr(key, fallback string) (time.Duration, error) {
	v := getEnv(key, fallback)
	return time.ParseDuration(v)
}
