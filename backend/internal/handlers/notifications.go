package handlers

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/email"
	"github.com/trucommerce/backend/internal/models"
	"github.com/trucommerce/backend/internal/services"
)

// NotificationHandler manages notification events, templates, recipients, logs, preview, and send.
type NotificationHandler struct {
	store   *services.Store
	emailH  *EmailHandler
}

func NewNotificationHandler(store *services.Store, emailH *EmailHandler) *NotificationHandler {
	return &NotificationHandler{store: store, emailH: emailH}
}

// ---------------- Events ----------------

func (h *NotificationHandler) ListEvents(c *gin.Context) {
	tid := tenantID(c)
	limit, offset := pagingParams(c)
	events, total, err := h.store.ListNotificationEventsPaged(c.Request.Context(), tid, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": events, "total": total, "limit": limit, "offset": offset})
}

func (h *NotificationHandler) CreateEvent(c *gin.Context) {
	tid := tenantID(c)
	var req models.NotificationEventReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Code == "" || req.Name == "" {
		errResponse(c, http.StatusBadRequest, "code and name are required")
		return
	}
	e := &models.NotificationEvent{
		TenantID:    tid,
		Code:        req.Code,
		Name:        req.Name,
		Description: req.Description,
		IsActive:    req.IsActive,
		IsInstant:   req.IsInstant,
	}
	if err := h.store.CreateNotificationEvent(c.Request.Context(), e); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, e)
}

func (h *NotificationHandler) UpdateEvent(c *gin.Context) {
	tid := tenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid event id")
		return
	}
	var req models.NotificationEventReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	e := &models.NotificationEvent{
		ID:          id,
		TenantID:    tid,
		Code:        req.Code,
		Name:        req.Name,
		Description: req.Description,
		IsActive:    req.IsActive,
		IsInstant:   req.IsInstant,
	}
	if err := h.store.UpdateNotificationEvent(c.Request.Context(), e); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, e)
}

func (h *NotificationHandler) DeleteEvent(c *gin.Context) {
	tid := tenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid event id")
		return
	}
	if err := h.store.DeleteNotificationEvent(c.Request.Context(), tid, id); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ---------------- Templates ----------------

func (h *NotificationHandler) ListTemplates(c *gin.Context) {
	tid := tenantID(c)
	var eventID *uuid.UUID
	if eidStr := c.Query("event_id"); eidStr != "" {
		eid, err := uuid.Parse(eidStr)
		if err == nil {
			eventID = &eid
		}
	}
	limit, offset := pagingParams(c)
	templates, total, err := h.store.ListNotificationTemplatesPaged(c.Request.Context(), tid, eventID, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": templates, "total": total, "limit": limit, "offset": offset})
}

func (h *NotificationHandler) GetTemplate(c *gin.Context) {
	tid := tenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid template id")
		return
	}
	t, err := h.store.GetNotificationTemplate(c.Request.Context(), tid, id)
	if err != nil {
		notFoundOrErr(c, err, "template not found")
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *NotificationHandler) CreateTemplate(c *gin.Context) {
	tid := tenantID(c)
	var req models.NotificationTemplateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Name == "" || req.Medium == "" || req.EventID == uuid.Nil {
		errResponse(c, http.StatusBadRequest, "name, medium, and event_id are required")
		return
	}
	if req.RecipientType == "" {
		req.RecipientType = "customer"
	}
	t := &models.NotificationTemplate{TenantID: tid}
	if err := h.store.CreateNotificationTemplate(c.Request.Context(), t, &req); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *NotificationHandler) UpdateTemplate(c *gin.Context) {
	tid := tenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid template id")
		return
	}
	var req models.NotificationTemplateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.Name == "" || req.Medium == "" {
		errResponse(c, http.StatusBadRequest, "name and medium are required")
		return
	}
	if req.RecipientType == "" {
		req.RecipientType = "customer"
	}
	t := &models.NotificationTemplate{TenantID: tid, ID: id}
	if err := h.store.UpdateNotificationTemplate(c.Request.Context(), tid, id, t, &req); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *NotificationHandler) DeleteTemplate(c *gin.Context) {
	tid := tenantID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "invalid template id")
		return
	}
	if err := h.store.DeleteNotificationTemplate(c.Request.Context(), tid, id); err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ---------------- Preview ----------------

var templateVarRe = regexp.MustCompile(`\{\{\s*(\w+)\s*\}\}`)

// renderTemplate replaces {{var}} placeholders with values from params.
func renderTemplate(tmpl string, params map[string]string) string {
	return templateVarRe.ReplaceAllStringFunc(tmpl, func(m string) string {
		key := strings.TrimSpace(strings.Trim(m, "{}"))
		if val, ok := params[key]; ok {
			return val
		}
		return m
	})
}

// Preview renders a template with provided parameters and returns the result.
func (h *NotificationHandler) Preview(c *gin.Context) {
	var req models.NotificationPreviewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	params := req.Parameters
	if params == nil {
		params = map[string]string{}
	}
	subject := renderTemplate(req.Subject, params)
	bodyHTML := renderTemplate(req.BodyHTML, params)
	bodyText := renderTemplate(req.BodyText, params)
	c.JSON(http.StatusOK, gin.H{
		"subject":    subject,
		"body_html":  bodyHTML,
		"body_text":  bodyText,
	})
}

// ---------------- Send ----------------

// Send manually dispatches a notification to specified recipients.
func (h *NotificationHandler) Send(c *gin.Context) {
	tid := tenantID(c)
	var req models.NotificationSendReq
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, err.Error())
		return
	}
	if req.TemplateID == uuid.Nil || len(req.To) == 0 {
		errResponse(c, http.StatusBadRequest, "template_id and to[] are required")
		return
	}
	tmpl, err := h.store.GetNotificationTemplate(c.Request.Context(), tid, req.TemplateID)
	if err != nil {
		errResponse(c, http.StatusNotFound, "template not found")
		return
	}
	params := req.Parameters
	if params == nil {
		params = map[string]string{}
	}
	subject := renderTemplate(tmpl.Subject, params)
	bodyHTML := renderTemplate(tmpl.BodyHTML, params)
	bodyText := renderTemplate(tmpl.BodyText, params)

	results := []gin.H{}
	for _, to := range req.To {
		logEntry := &models.NotificationLog{
			TenantID:  tid,
			TemplateID: &tmpl.ID,
			EventID:   &tmpl.EventID,
			Medium:    tmpl.Medium,
			Recipient: to,
			Subject:   subject,
			Body:      bodyHTML,
			Status:    "pending",
		}
		if tmpl.Medium == "email" {
			cfg := h.emailH.ResolveSMTPConfig(c, tid)
			if cfg.Host == "" {
				logEntry.Status = "failed"
				logEntry.Error = "SMTP is not configured"
			} else {
				if err := email.SendEmail(cfg, email.Email{
					To:      []string{to},
					Subject: subject,
					Body:    bodyHTML,
				}); err != nil {
					logEntry.Status = "failed"
					logEntry.Error = err.Error()
				} else {
					logEntry.Status = "sent"
					logEntry.SentAt = time.Now().UTC().Format(time.RFC3339)
				}
			}
		} else if tmpl.Medium == "sms" {
			// SMS not yet implemented — log as failed
			logEntry.Status = "failed"
			logEntry.Error = "SMS gateway not configured"
			_ = bodyText
		} else {
			logEntry.Status = "failed"
			logEntry.Error = "unsupported medium: " + tmpl.Medium
		}
		_ = h.store.CreateNotificationLog(c.Request.Context(), logEntry)
		results = append(results, gin.H{
			"recipient": to,
			"status":    logEntry.Status,
			"error":     logEntry.Error,
		})
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}

// ---------------- Logs ----------------

func (h *NotificationHandler) ListLogs(c *gin.Context) {
	tid := tenantID(c)
	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if v := parseIntSafe(l); v > 0 {
			limit = v
		}
	}
	if o := c.Query("offset"); o != "" {
		if v := parseIntSafe(o); v >= 0 {
			offset = v
		}
	}
	logs, err := h.store.ListNotificationLogs(c.Request.Context(), tid, limit, offset)
	if err != nil {
		errResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	total, _ := h.store.CountNotificationLogs(c.Request.Context(), tid)
	c.JSON(http.StatusOK, gin.H{"items": logs, "total": total, "limit": limit, "offset": offset})
}

func parseIntSafe(s string) int {
	n := 0
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0
		}
		n = n*10 + int(ch-'0')
	}
	return n
}
