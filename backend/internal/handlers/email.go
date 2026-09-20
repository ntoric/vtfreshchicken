package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/config"
	"github.com/trucommerce/backend/internal/email"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// EmailHandler manages per-tenant SMTP configuration and sends transactional emails.
type EmailHandler struct {
	store *services.Store
	cfg   *config.Config
}

func NewEmailHandler(store *services.Store, cfg *config.Config) *EmailHandler {
	return &EmailHandler{store: store, cfg: cfg}
}

type updateSMTPReq struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	FromEmail  string `json:"from_email"`
	FromName   string `json:"from_name"`
	Encryption string `json:"encryption"`
	Enabled    *bool  `json:"enabled"`
}

// GetSMTPSettings returns the tenant's SMTP configuration.
// The password is masked unless ?include_secrets=true is passed.
func (h *EmailHandler) GetSMTPSettings(c *gin.Context) {
	tid := tenantID(c)
	smtp, err := h.store.GetTenantSMTPSettings(c.Request.Context(), tid)
	if err != nil {
		// No settings row yet — return defaults
		c.JSON(http.StatusOK, gin.H{
			"tenant_id":  tid,
			"host":       "",
			"port":       587,
			"username":   "",
			"password":   "",
			"from_email": "",
			"from_name":  "",
			"encryption": "starttls",
			"enabled":    false,
		})
		return
	}
	includeSecrets := c.Query("include_secrets") == "true"
	if !includeSecrets && smtp.Password != "" {
		smtp.Password = "********"
	}
	c.JSON(http.StatusOK, smtp)
}

// UpdateSMTPSettings creates or updates the tenant's SMTP configuration.
func (h *EmailHandler) UpdateSMTPSettings(c *gin.Context) {
	tid := tenantID(c)
	var req updateSMTPReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	// Validate encryption mode
	enc := strings.ToLower(req.Encryption)
	if enc == "" {
		enc = "starttls"
	}
	if enc != "none" && enc != "ssl" && enc != "starttls" {
		errResponse(c, http.StatusBadRequest, "encryption must be one of: none, ssl, starttls")
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	// If password is the mask value, preserve the existing password
	password := req.Password
	if password == "********" {
		existing, err := h.store.GetTenantSMTPSettings(c.Request.Context(), tid)
		if err == nil && existing != nil {
			password = existing.Password
		}
	}
	smtp := &models.TenantSMTPSettings{
		TenantID:   tid,
		Host:       req.Host,
		Port:       req.Port,
		Username:   req.Username,
		Password:   password,
		FromEmail:  req.FromEmail,
		FromName:   req.FromName,
		Encryption: enc,
		Enabled:    enabled,
	}
	if smtp.Port == 0 {
		smtp.Port = 587
	}
	if err := h.store.UpsertTenantSMTPSettings(c.Request.Context(), smtp); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	// Mask password in response
	smtp.Password = "********"
	c.JSON(http.StatusOK, smtp)
}

type testEmailReq struct {
	To string `json:"to" binding:"required,email"`
}

// TestSMTPSettings sends a test email using the tenant's SMTP configuration
// (or platform-level SMTP if tenant SMTP is disabled).
func (h *EmailHandler) TestSMTPSettings(c *gin.Context) {
	tid := tenantID(c)
	var req testEmailReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	cfg := h.resolveSMTPConfig(c, tid)
	if cfg.Host == "" {
		errResponse(c, http.StatusBadRequest, "SMTP is not configured. Set up tenant SMTP or configure platform-level SMTP env vars.")
		return
	}
	body := `<html><body style="font-family: Arial, sans-serif; padding: 20px;">
<h2 style="color: #4f46e5;">SMTP Test Successful</h2>
<p>This confirms that your SMTP configuration is working correctly.</p>
<p>If you received this email, transactional emails from your store will be delivered successfully.</p>
<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
<p style="color: #666; font-size: 12px;">This is an automated test message from your store's email system.</p>
</body></html>`
	if err := email.SendEmail(cfg, email.Email{
		To:      []string{req.To},
		Subject: "SMTP Test — Your Store Email is Working",
		Body:    body,
	}); err != nil {
		errResponse(c, http.StatusInternalServerError, "Failed to send test email: "+err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Test email sent successfully"})
}

// resolveSMTPConfig returns the tenant's SMTP config if enabled, otherwise falls back to platform-level env vars.
func (h *EmailHandler) resolveSMTPConfig(c *gin.Context, tid uuid.UUID) email.SMTPConfig {
	smtp, err := h.store.GetTenantSMTPSettings(c.Request.Context(), tid)
	if err == nil && smtp != nil && smtp.Enabled && smtp.Host != "" {
		return email.SMTPConfig{
			Host:       smtp.Host,
			Port:       smtp.Port,
			Username:   smtp.Username,
			Password:   smtp.Password,
			FromEmail:  smtp.FromEmail,
			FromName:   smtp.FromName,
			Encryption: smtp.Encryption,
		}
	}
	// Fall back to platform-level SMTP from env vars
	return email.SMTPConfig{
		Host:       h.cfg.SMTPHost,
		Port:       h.cfg.SMTPPort,
		Username:   h.cfg.SMTPUser,
		Password:   h.cfg.SMTPPassword,
		FromEmail:  h.cfg.SMTPFrom,
		FromName:   h.cfg.SMTPFromName,
		Encryption: "starttls",
	}
}

// ResolveSMTPConfig is exported for use by other handlers (e.g. checkout) to send emails.
func (h *EmailHandler) ResolveSMTPConfig(c *gin.Context, tid uuid.UUID) email.SMTPConfig {
	return h.resolveSMTPConfig(c, tid)
}
