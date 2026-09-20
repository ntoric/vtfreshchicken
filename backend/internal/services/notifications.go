package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
)

// ---------------- Notification Events ----------------

func (s *Store) ListNotificationEvents(ctx context.Context, tenantID uuid.UUID) ([]models.NotificationEvent, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, code, name, COALESCE(description,''), is_active, is_instant,
		        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		 FROM notification_events WHERE tenant_id=$1 ORDER BY name ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.NotificationEvent
	for rows.Next() {
		var e models.NotificationEvent
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Code, &e.Name, &e.Description, &e.IsActive, &e.IsInstant, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

func (s *Store) GetNotificationEvent(ctx context.Context, tenantID, eventID uuid.UUID) (*models.NotificationEvent, error) {
	var e models.NotificationEvent
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, code, name, COALESCE(description,''), is_active, is_instant,
		        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		        to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		 FROM notification_events WHERE id=$1 AND tenant_id=$2`, eventID, tenantID).
		Scan(&e.ID, &e.TenantID, &e.Code, &e.Name, &e.Description, &e.IsActive, &e.IsInstant, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (s *Store) CreateNotificationEvent(ctx context.Context, e *models.NotificationEvent) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO notification_events (tenant_id, code, name, description, is_active, is_instant)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'), to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')`,
		e.TenantID, e.Code, e.Name, e.Description, e.IsActive, e.IsInstant,
	).Scan(&e.ID, &e.CreatedAt, &e.UpdatedAt)
}

func (s *Store) UpdateNotificationEvent(ctx context.Context, e *models.NotificationEvent) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE notification_events SET code=$3, name=$4, description=$5, is_active=$6, is_instant=$7, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		e.ID, e.TenantID, e.Code, e.Name, e.Description, e.IsActive, e.IsInstant)
	return err
}

func (s *Store) DeleteNotificationEvent(ctx context.Context, tenantID, eventID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM notification_events WHERE id=$1 AND tenant_id=$2`, eventID, tenantID)
	return err
}

// ---------------- Notification Templates ----------------

func (s *Store) ListNotificationTemplates(ctx context.Context, tenantID uuid.UUID, eventID *uuid.UUID) ([]models.NotificationTemplate, error) {
	q := `SELECT t.id, t.tenant_id, t.event_id, e.code, e.name, t.name, t.medium,
	             COALESCE(t.subject,''), COALESCE(t.body_html,''), COALESCE(t.body_text,''),
	             t.parameters, t.recipient_type, t.is_active,
	             to_char(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
	             to_char(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
	      FROM notification_templates t
	      JOIN notification_events e ON e.id = t.event_id
	      WHERE t.tenant_id = $1`
	args := []interface{}{tenantID}
	if eventID != nil {
		q += ` AND t.event_id = $2`
		args = append(args, *eventID)
	}
	q += ` ORDER BY t.name ASC`
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.NotificationTemplate
	for rows.Next() {
		var t models.NotificationTemplate
		var paramsJSON []byte
		if err := rows.Scan(&t.ID, &t.TenantID, &t.EventID, &t.EventCode, &t.EventName, &t.Name, &t.Medium,
			&t.Subject, &t.BodyHTML, &t.BodyText, &paramsJSON, &t.RecipientType, &t.IsActive, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		if len(paramsJSON) > 0 {
			_ = json.Unmarshal(paramsJSON, &t.Parameters)
		}
		out = append(out, t)
	}
	return out, nil
}

func (s *Store) GetNotificationTemplate(ctx context.Context, tenantID, templateID uuid.UUID) (*models.NotificationTemplate, error) {
	var t models.NotificationTemplate
	var paramsJSON []byte
	err := s.Pool.QueryRow(ctx,
		`SELECT t.id, t.tenant_id, t.event_id, e.code, e.name, t.name, t.medium,
		        COALESCE(t.subject,''), COALESCE(t.body_html,''), COALESCE(t.body_text,''),
		        t.parameters, t.recipient_type, t.is_active,
		        to_char(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		        to_char(t.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		 FROM notification_templates t
		 JOIN notification_events e ON e.id = t.event_id
		 WHERE t.id=$1 AND t.tenant_id=$2`, templateID, tenantID).
		Scan(&t.ID, &t.TenantID, &t.EventID, &t.EventCode, &t.EventName, &t.Name, &t.Medium,
			&t.Subject, &t.BodyHTML, &t.BodyText, &paramsJSON, &t.RecipientType, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if len(paramsJSON) > 0 {
		_ = json.Unmarshal(paramsJSON, &t.Parameters)
	}
	// Load recipients
	recips, err := s.ListNotificationRecipients(ctx, tenantID, templateID)
	if err != nil {
		return nil, err
	}
	t.Recipients = recips
	return &t, nil
}

func (s *Store) CreateNotificationTemplate(ctx context.Context, t *models.NotificationTemplate, req *models.NotificationTemplateReq) error {
	paramsJSON, _ := json.Marshal(req.Parameters)
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx,
		`INSERT INTO notification_templates (tenant_id, event_id, name, medium, subject, body_html, body_text, parameters, recipient_type, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'), to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')`,
		t.TenantID, req.EventID, req.Name, req.Medium, nullableStr(req.Subject), req.BodyHTML, req.BodyText, paramsJSON, req.RecipientType, req.IsActive,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return err
	}

	// Populate the returned struct from the request so the handler can
	// return a fully-formed object without an extra SELECT.
	t.EventID = req.EventID
	t.Name = req.Name
	t.Medium = req.Medium
	t.Subject = req.Subject
	t.BodyHTML = req.BodyHTML
	t.BodyText = req.BodyText
	t.Parameters = req.Parameters
	t.RecipientType = req.RecipientType
	t.IsActive = req.IsActive

	for _, r := range req.Recipients {
		_, err = tx.Exec(ctx,
			`INSERT INTO notification_recipients (tenant_id, template_id, name, email, phone)
			 VALUES ($1,$2,$3,$4,$5)`,
			t.TenantID, t.ID, r.Name, r.Email, r.Phone)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) UpdateNotificationTemplate(ctx context.Context, tenantID, templateID uuid.UUID, t *models.NotificationTemplate, req *models.NotificationTemplateReq) error {
	paramsJSON, _ := json.Marshal(req.Parameters)
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`UPDATE notification_templates SET event_id=$3, name=$4, medium=$5, subject=$6, body_html=$7, body_text=$8,
		 parameters=$9, recipient_type=$10, is_active=$11, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		templateID, tenantID, req.EventID, req.Name, req.Medium, nullableStr(req.Subject), req.BodyHTML, req.BodyText,
		paramsJSON, req.RecipientType, req.IsActive)
	if err != nil {
		return err
	}

	// Replace recipients
	_, _ = tx.Exec(ctx, `DELETE FROM notification_recipients WHERE template_id=$1 AND tenant_id=$2`, templateID, tenantID)
	for _, r := range req.Recipients {
		_, err = tx.Exec(ctx,
			`INSERT INTO notification_recipients (tenant_id, template_id, name, email, phone)
			 VALUES ($1,$2,$3,$4,$5)`,
			tenantID, templateID, r.Name, r.Email, r.Phone)
		if err != nil {
			return err
		}
	}

	// Populate the returned struct from the request so the handler can
	// return a fully-formed object without an extra SELECT.
	t.ID = templateID
	t.TenantID = tenantID
	t.EventID = req.EventID
	t.Name = req.Name
	t.Medium = req.Medium
	t.Subject = req.Subject
	t.BodyHTML = req.BodyHTML
	t.BodyText = req.BodyText
	t.Parameters = req.Parameters
	t.RecipientType = req.RecipientType
	t.IsActive = req.IsActive

	return tx.Commit(ctx)
}

func (s *Store) DeleteNotificationTemplate(ctx context.Context, tenantID, templateID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM notification_templates WHERE id=$1 AND tenant_id=$2`, templateID, tenantID)
	return err
}

// ---------------- Notification Recipients ----------------

func (s *Store) ListNotificationRecipients(ctx context.Context, tenantID, templateID uuid.UUID) ([]models.NotificationRecipient, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, template_id, COALESCE(name,''), COALESCE(email,''), COALESCE(phone,''),
		        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		 FROM notification_recipients WHERE tenant_id=$1 AND template_id=$2 ORDER BY created_at ASC`, tenantID, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.NotificationRecipient
	for rows.Next() {
		var r models.NotificationRecipient
		if err := rows.Scan(&r.ID, &r.TenantID, &r.TemplateID, &r.Name, &r.Email, &r.Phone, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

// ---------------- Notification Logs ----------------

func (s *Store) ListNotificationLogs(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.NotificationLog, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, COALESCE(template_id::text,''), COALESCE(event_id::text,''), medium, recipient,
		        COALESCE(subject,''), COALESCE(body,''), status, COALESCE(error,''),
		        COALESCE(to_char(sent_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),''),
		        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		 FROM notification_logs WHERE tenant_id=$1
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.NotificationLog
	for rows.Next() {
		var l models.NotificationLog
		var templateID, eventID string
		if err := rows.Scan(&l.ID, &l.TenantID, &templateID, &eventID, &l.Medium, &l.Recipient,
			&l.Subject, &l.Body, &l.Status, &l.Error, &l.SentAt, &l.CreatedAt); err != nil {
			return nil, err
		}
		if templateID != "" {
			if id, err := uuid.Parse(templateID); err == nil {
				l.TemplateID = &id
			}
		}
		if eventID != "" {
			if id, err := uuid.Parse(eventID); err == nil {
				l.EventID = &id
			}
		}
		out = append(out, l)
	}
	return out, nil
}

func (s *Store) CreateNotificationLog(ctx context.Context, l *models.NotificationLog) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO notification_logs (tenant_id, template_id, event_id, medium, recipient, subject, body, status, error, sent_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')`,
		l.TenantID, l.TemplateID, l.EventID, l.Medium, l.Recipient,
		nullableStr(l.Subject), nullableStr(l.Body), l.Status, nullableStr(l.Error), nullableStr(l.SentAt),
	).Scan(&l.ID, &l.CreatedAt)
}

func (s *Store) CountNotificationLogs(ctx context.Context, tenantID uuid.UUID) (int, error) {
	var count int
	err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM notification_logs WHERE tenant_id=$1`, tenantID).Scan(&count)
	return count, err
}

// ---------------- Helpers ----------------

// ResolveTemplateRecipients returns email addresses for a template based on its recipient_type.
func (s *Store) ResolveTemplateRecipients(ctx context.Context, tenantID, templateID uuid.UUID) ([]string, error) {
	var recipientType string
	err := s.Pool.QueryRow(ctx,
		`SELECT recipient_type FROM notification_templates WHERE id=$1 AND tenant_id=$2`, templateID, tenantID).Scan(&recipientType)
	if err != nil {
		return nil, err
	}

	switch recipientType {
	case "specific_emails":
		rows, err := s.Pool.Query(ctx,
			`SELECT email FROM notification_recipients WHERE template_id=$1 AND tenant_id=$2 AND email != ''`, templateID, tenantID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []string
		for rows.Next() {
			var email string
			if err := rows.Scan(&email); err != nil {
				return nil, err
			}
			out = append(out, email)
		}
		return out, nil
	case "all_customers":
		rows, err := s.Pool.Query(ctx,
			`SELECT email FROM users WHERE tenant_id=$1 AND role='customer' AND is_active=true AND email != ''`, tenantID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []string
		for rows.Next() {
			var email string
			if err := rows.Scan(&email); err != nil {
				return nil, err
			}
			out = append(out, email)
		}
		return out, nil
	case "all_staff":
		rows, err := s.Pool.Query(ctx,
			`SELECT email FROM users WHERE tenant_id=$1 AND role IN ('staff','business_admin') AND is_active=true AND email != ''`, tenantID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []string
		for rows.Next() {
			var email string
			if err := rows.Scan(&email); err != nil {
				return nil, err
			}
			out = append(out, email)
		}
		return out, nil
	case "business_admin":
		rows, err := s.Pool.Query(ctx,
			`SELECT email FROM users WHERE tenant_id=$1 AND role='business_admin' AND is_active=true AND email != ''`, tenantID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []string
		for rows.Next() {
			var email string
			if err := rows.Scan(&email); err != nil {
				return nil, err
			}
			out = append(out, email)
		}
		return out, nil
	default:
		return nil, fmt.Errorf("unsupported recipient_type: %s", recipientType)
	}
}

var _ = pgx.ErrNoRows
