package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/email"
	"github.com/trucommerce/backend/internal/services"
)

// ContactHandler handles public contact form submissions and admin management.
type ContactHandler struct {
	store  *services.Store
	emailH *EmailHandler
}

func NewContactHandler(store *services.Store, emailH *EmailHandler) *ContactHandler {
	return &ContactHandler{store: store, emailH: emailH}
}

type contactSubmissionReq struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Phone   string `json:"phone"`
	Subject string `json:"subject"`
	Message string `json:"message"`
}

// SubmitContact is a public endpoint that stores a contact form submission
// and optionally emails it to the tenant's configured SMTP recipient.
func (h *ContactHandler) SubmitContact(c *gin.Context) {
	tid := tenantID(c)
	var req contactSubmissionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Message == "" {
		errResponse(c, http.StatusBadRequest, "message is required")
		return
	}

	sub, err := h.store.CreateContactSubmission(c.Request.Context(), tid, req.Name, req.Email, req.Phone, req.Subject, req.Message)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	// Best-effort email notification — don't fail the request if SMTP isn't configured
	go func() {
		smtp, err := h.store.GetTenantSMTPSettings(c.Request.Context(), tid)
		if err != nil || smtp == nil || !smtp.Enabled || smtp.Host == "" {
			return
		}
		tenant, _ := h.store.GetTenantByID(c.Request.Context(), tid)
		to := smtp.FromEmail
		if to == "" {
			return
		}
		subject := "New contact form submission"
		if req.Subject != "" {
			subject = req.Subject
		}
		body := "<h2>New contact form submission</h2>"
		if tenant != nil {
			body += "<p><strong>Store:</strong> " + tenant.Name + "</p>"
		}
		body += "<p><strong>Name:</strong> " + req.Name + "</p>"
		body += "<p><strong>Email:</strong> " + req.Email + "</p>"
		if req.Phone != "" {
			body += "<p><strong>Phone:</strong> " + req.Phone + "</p>"
		}
		body += "<p><strong>Subject:</strong> " + req.Subject + "</p>"
		body += "<p><strong>Message:</strong></p><p>" + req.Message + "</p>"

		_ = email.SendEmail(email.SMTPConfig{
			Host:       smtp.Host,
			Port:       smtp.Port,
			Username:   smtp.Username,
			Password:   smtp.Password,
			FromEmail:  smtp.FromEmail,
			FromName:   smtp.FromName,
			Encryption: smtp.Encryption,
		}, email.Email{
			To:      []string{to},
			Subject: subject,
			Body:    body,
		})
	}()

	c.JSON(http.StatusCreated, gin.H{"message": "Contact form submitted successfully", "submission": sub})
}

// ListSubmissions returns contact submissions for the tenant (admin only).
func (h *ContactHandler) ListSubmissions(c *gin.Context) {
	tid := tenantID(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.DefaultQuery("status", "")
	items, total, err := h.store.ListContactSubmissions(c.Request.Context(), tid, status, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total})
}

// MarkRead marks a contact submission as read (admin only).
func (h *ContactHandler) MarkRead(c *gin.Context) {
	tid := tenantID(c)
	subID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid submission id")
		return
	}
	if err := h.store.MarkContactSubmissionRead(c.Request.Context(), tid, subID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

// DeleteSubmission deletes a contact submission (admin only).
func (h *ContactHandler) DeleteSubmission(c *gin.Context) {
	tid := tenantID(c)
	subID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid submission id")
		return
	}
	if err := h.store.DeleteContactSubmission(c.Request.Context(), tid, subID); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}
