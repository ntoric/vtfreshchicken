package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/trucommerce/backend/internal/models"
)

// pgxJSONMarshal marshals a value to a []byte suitable for JSONB columns.
func pgxJSONMarshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

type Store struct {
	Pool *pgxpool.Pool
}

// DateRangeFilter holds optional from/to date bounds (inclusive). Used by stats
// and list endpoints to scope results to a date window.
type DateRangeFilter struct {
	From string // ISO date or RFC3339, empty = no lower bound
	To   string // ISO date or RFC3339, empty = no upper bound
}

// dateRangeClause returns a SQL clause + args that constrains a timestamp column
// to the [From, To] window. argIdx is the next placeholder index to use.
// Returns the clause (with leading " AND " when non-empty) and the new argIdx.
func dateRangeClause(column string, dr DateRangeFilter, args []interface{}, argIdx int) (string, []interface{}, int) {
	var clause string
	if dr.From != "" {
		clause += fmt.Sprintf(" AND %s >= $%d", column, argIdx)
		args = append(args, dr.From)
		argIdx++
	}
	if dr.To != "" {
		clause += fmt.Sprintf(" AND %s <= $%d", column, argIdx)
		args = append(args, dr.To)
		argIdx++
	}
	return clause, args, argIdx
}

func NewStore(pool *pgxpool.Pool) *Store { return &Store{Pool: pool} }

// ---------------- Tenants ----------------

func (s *Store) GetTenantBySlug(ctx context.Context, slug string) (*models.Tenant, error) {
	t := &models.Tenant{}
	err := s.Pool.QueryRow(ctx, `SELECT id, slug, name, description, is_active, COALESCE(contact_email,''), COALESCE(contact_phone,''), COALESCE(country,''), COALESCE(city,''), COALESCE(address,''), plan, commission_rate, created_at, updated_at FROM tenants WHERE slug=$1`, slug).
		Scan(&t.ID, &t.Slug, &t.Name, &t.Description, &t.IsActive, &t.ContactEmail, &t.ContactPhone, &t.Country, &t.City, &t.Address, &t.Plan, &t.CommissionRate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Store) GetTenantByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error) {
	t := &models.Tenant{}
	err := s.Pool.QueryRow(ctx, `SELECT id, slug, name, description, is_active, COALESCE(contact_email,''), COALESCE(contact_phone,''), COALESCE(country,''), COALESCE(city,''), COALESCE(address,''), plan, commission_rate, created_at, updated_at FROM tenants WHERE id=$1`, id).
		Scan(&t.ID, &t.Slug, &t.Name, &t.Description, &t.IsActive, &t.ContactEmail, &t.ContactPhone, &t.Country, &t.City, &t.Address, &t.Plan, &t.CommissionRate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Store) ListTenants(ctx context.Context) ([]models.Tenant, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, slug, name, description, is_active, COALESCE(contact_email,''), COALESCE(contact_phone,''), COALESCE(country,''), COALESCE(city,''), COALESCE(address,''), plan, commission_rate, created_at, updated_at FROM tenants ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Tenant
	for rows.Next() {
		var t models.Tenant
		if err := rows.Scan(&t.ID, &t.Slug, &t.Name, &t.Description, &t.IsActive, &t.ContactEmail, &t.ContactPhone, &t.Country, &t.City, &t.Address, &t.Plan, &t.CommissionRate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

func (s *Store) CreateTenant(ctx context.Context, slug, name, description string) (*models.Tenant, error) {
	t := &models.Tenant{}
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO tenants (slug, name, description) VALUES ($1,$2,$3)
		 RETURNING id, slug, name, description, is_active, COALESCE(contact_email,''), COALESCE(contact_phone,''), COALESCE(country,''), COALESCE(city,''), COALESCE(address,''), plan, commission_rate, created_at, updated_at`,
		slug, name, description).
		Scan(&t.ID, &t.Slug, &t.Name, &t.Description, &t.IsActive, &t.ContactEmail, &t.ContactPhone, &t.Country, &t.City, &t.Address, &t.Plan, &t.CommissionRate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// UpdateTenant updates store metadata (superadmin only).
func (s *Store) UpdateTenant(ctx context.Context, id uuid.UUID, name, description, contactEmail, contactPhone, country, city, address, plan string, commissionRate float64) (*models.Tenant, error) {
	t := &models.Tenant{}
	err := s.Pool.QueryRow(ctx,
		`UPDATE tenants SET name=$2, description=$3, contact_email=$4, contact_phone=$5, country=$6, city=$7, address=$8, plan=$9, commission_rate=$10, updated_at=NOW()
		 WHERE id=$1
		 RETURNING id, slug, name, description, is_active, COALESCE(contact_email,''), COALESCE(contact_phone,''), COALESCE(country,''), COALESCE(city,''), COALESCE(address,''), plan, commission_rate, created_at, updated_at`,
		id, name, description, contactEmail, contactPhone, country, city, address, plan, commissionRate).
		Scan(&t.ID, &t.Slug, &t.Name, &t.Description, &t.IsActive, &t.ContactEmail, &t.ContactPhone, &t.Country, &t.City, &t.Address, &t.Plan, &t.CommissionRate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// SetTenantActive activates or deactivates a tenant store.
func (s *Store) SetTenantActive(ctx context.Context, id uuid.UUID, active bool) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE tenants SET is_active=$2, updated_at=NOW() WHERE id=$1`, id, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// StoreStats returns summary statistics for a tenant store.
func (s *Store) StoreStats(ctx context.Context, tenantID uuid.UUID) (*models.StoreStats, error) {
	stats := &models.StoreStats{}
	err := s.Pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM products WHERE tenant_id=$1),
			(SELECT COUNT(*) FROM orders WHERE tenant_id=$1),
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND role='customer'),
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND role IN ('business_admin','staff')),
			(SELECT COUNT(*) FROM vendors WHERE tenant_id=$1),
			COALESCE((SELECT SUM(grand_total) FROM orders WHERE tenant_id=$1 AND status NOT IN ('cancelled','failed')), 0)
		`, tenantID).
		Scan(&stats.ProductCount, &stats.OrderCount, &stats.CustomerCount, &stats.StaffCount, &stats.VendorCount, &stats.Revenue)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

// PlatformStats returns aggregate KPIs across all tenants for the superadmin dashboard.
func (s *Store) PlatformStats(ctx context.Context) (*models.PlatformStats, error) {
	stats := &models.PlatformStats{
		OrdersByStatus: map[string]int{},
		TenantsByPlan:  map[string]int{},
		TopTenants:     []models.TenantKPI{},
		RecentOrders:   []models.PlatformOrder{},
	}

	// 1. Tenant counts + plan breakdown
	rows, err := s.Pool.Query(ctx,
		`SELECT is_active, COALESCE(NULLIF(plan, ''), 'standard'), COUNT(*) FROM tenants GROUP BY is_active, plan`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var isActive bool
		var plan string
		var count int
		if err := rows.Scan(&isActive, &plan, &count); err != nil {
			return nil, err
		}
		stats.TenantCount += count
		if isActive {
			stats.ActiveTenants += count
		} else {
			stats.InactiveTenants += count
		}
		stats.TenantsByPlan[plan] += count
	}
	rows.Close()

	// 2. New tenants this month
	err = s.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM tenants WHERE created_at >= date_trunc('month', NOW())`).Scan(&stats.NewTenantsThisMonth)
	if err != nil {
		return nil, err
	}

	// 3. Aggregate product/order/customer/staff/vendor counts + total revenue
	err = s.Pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM products),
			(SELECT COUNT(*) FROM orders),
			(SELECT COUNT(*) FROM users WHERE role='customer'),
			(SELECT COUNT(*) FROM users WHERE role IN ('business_admin','staff')),
			(SELECT COUNT(*) FROM vendors),
			COALESCE((SELECT SUM(grand_total) FROM orders WHERE status NOT IN ('cancelled','failed')), 0)
		`).Scan(&stats.TotalProducts, &stats.TotalOrders, &stats.TotalCustomers, &stats.TotalStaff, &stats.TotalVendors, &stats.TotalRevenue)
	if err != nil {
		return nil, err
	}

	// 4. Orders by status (platform-wide)
	rows, err = s.Pool.Query(ctx,
		`SELECT status, COUNT(*) FROM orders GROUP BY status ORDER BY COUNT(*) DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats.OrdersByStatus[status] = count
	}
	rows.Close()

	// 5. Top tenants by revenue (top 5)
	rows, err = s.Pool.Query(ctx,
		`SELECT t.id, t.slug, t.name, t.is_active, COALESCE(NULLIF(t.plan, ''), 'standard'),
			COUNT(DISTINCT o.id) AS orders,
			(SELECT COUNT(*) FROM products WHERE tenant_id = t.id) AS products,
			(SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND role='customer') AS customers,
			COALESCE(SUM(o.grand_total) FILTER (WHERE o.status NOT IN ('cancelled','failed')), 0) AS revenue
		 FROM tenants t
		 LEFT JOIN orders o ON o.tenant_id = t.id
		 GROUP BY t.id, t.slug, t.name, t.is_active, t.plan
		 ORDER BY revenue DESC
		 LIMIT 5`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var k models.TenantKPI
		if err := rows.Scan(&k.TenantID, &k.Slug, &k.Name, &k.IsActive, &k.Plan, &k.Orders, &k.Products, &k.Customers, &k.Revenue); err != nil {
			return nil, err
		}
		stats.TopTenants = append(stats.TopTenants, k)
	}
	rows.Close()

	// 6. Recent orders across all tenants (latest 8)
	rows, err = s.Pool.Query(ctx,
		`SELECT o.id, o.tenant_id, t.slug, t.name, o.status, o.grand_total, o.currency_code, o.created_at
		 FROM orders o
		 JOIN tenants t ON t.id = o.tenant_id
		 ORDER BY o.created_at DESC
		 LIMIT 8`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var o models.PlatformOrder
		if err := rows.Scan(&o.ID, &o.TenantID, &o.TenantSlug, &o.TenantName, &o.Status, &o.Total, &o.Currency, &o.CreatedAt); err != nil {
			return nil, err
		}
		stats.RecentOrders = append(stats.RecentOrders, o)
	}

	return stats, nil
}

func (s *Store) GetTenantSettings(ctx context.Context, tenantID uuid.UUID) (*models.TenantSettings, error) {
	ts := &models.TenantSettings{TenantID: tenantID}
	var curID *uuid.UUID
	var landingContent []byte
	err := s.Pool.QueryRow(ctx,
		`SELECT default_currency_id, default_language, supported_languages, brand_color, logo_url,
		        landing_page_enabled, landing_page_content, tax_inclusive, tax_shipping, default_tax_class_id,
		        anonymous_checkout, return_period_days, refund_period_days, replacement_period_days,
		        meta_title, meta_description, og_image, site_url, social_links
		 FROM tenant_settings WHERE tenant_id=$1`, tenantID).
		Scan(&curID, &ts.DefaultLanguage, &ts.SupportedLanguages, &ts.BrandColor, &ts.LogoURL,
			&ts.LandingPageEnabled, &landingContent, &ts.TaxInclusive, &ts.TaxShipping, &ts.DefaultTaxClassID,
			&ts.AnonymousCheckout, &ts.ReturnPeriodDays, &ts.RefundPeriodDays, &ts.ReplacementPeriodDays,
			&ts.MetaTitle, &ts.MetaDescription, &ts.OGImage, &ts.SiteURL, &ts.SocialLinks)
	if err != nil {
		return nil, err
	}
	ts.DefaultCurrencyID = curID
	if len(landingContent) > 0 {
		var lc models.LandingPageContent
		if err := json.Unmarshal(landingContent, &lc); err == nil {
			ts.LandingPageContent = &lc
		}
	}
	return ts, nil
}

func (s *Store) UpsertTenantSettings(ctx context.Context, ts *models.TenantSettings) error {
	var landingContent []byte
	if ts.LandingPageContent != nil {
		var err error
		landingContent, err = json.Marshal(ts.LandingPageContent)
		if err != nil {
			return err
		}
	}
	// Ensure SocialLinks is never nil — the DB column is JSONB NOT NULL
	if ts.SocialLinks == nil {
		ts.SocialLinks = []string{}
	}
	_, err := s.Pool.Exec(ctx,
		`INSERT INTO tenant_settings (tenant_id, default_currency_id, default_language, supported_languages, brand_color, logo_url,
		       landing_page_enabled, landing_page_content, tax_inclusive, tax_shipping, default_tax_class_id,
		       anonymous_checkout, return_period_days, refund_period_days, replacement_period_days,
		       meta_title, meta_description, og_image, site_url, social_links)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		 ON CONFLICT (tenant_id) DO UPDATE SET
		   default_currency_id=EXCLUDED.default_currency_id,
		   default_language=EXCLUDED.default_language,
		   supported_languages=EXCLUDED.supported_languages,
		   brand_color=EXCLUDED.brand_color,
		   logo_url=EXCLUDED.logo_url,
		   landing_page_enabled=EXCLUDED.landing_page_enabled,
		   landing_page_content=EXCLUDED.landing_page_content,
		   tax_inclusive=EXCLUDED.tax_inclusive,
		   tax_shipping=EXCLUDED.tax_shipping,
		   default_tax_class_id=EXCLUDED.default_tax_class_id,
		   anonymous_checkout=EXCLUDED.anonymous_checkout,
		   return_period_days=EXCLUDED.return_period_days,
		   refund_period_days=EXCLUDED.refund_period_days,
		   replacement_period_days=EXCLUDED.replacement_period_days,
		   meta_title=EXCLUDED.meta_title,
		   meta_description=EXCLUDED.meta_description,
		   og_image=EXCLUDED.og_image,
		   site_url=EXCLUDED.site_url,
		   social_links=EXCLUDED.social_links`,
		ts.TenantID, ts.DefaultCurrencyID, ts.DefaultLanguage, ts.SupportedLanguages, ts.BrandColor, ts.LogoURL,
		ts.LandingPageEnabled, landingContent, ts.TaxInclusive, ts.TaxShipping, ts.DefaultTaxClassID,
		ts.AnonymousCheckout, ts.ReturnPeriodDays, ts.RefundPeriodDays, ts.ReplacementPeriodDays,
		ts.MetaTitle, ts.MetaDescription, ts.OGImage, ts.SiteURL, ts.SocialLinks)
	return err
}

// ---------------- Tenant SMTP settings ----------------

func (s *Store) GetTenantSMTPSettings(ctx context.Context, tenantID uuid.UUID) (*models.TenantSMTPSettings, error) {
	smtp := &models.TenantSMTPSettings{TenantID: tenantID}
	err := s.Pool.QueryRow(ctx,
		`SELECT host, port, username, password, from_email, from_name, encryption, enabled,
		        COALESCE(to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'), ''),
		        COALESCE(to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'), '')
		 FROM tenant_smtp_settings WHERE tenant_id=$1`, tenantID).
		Scan(&smtp.Host, &smtp.Port, &smtp.Username, &smtp.Password, &smtp.FromEmail, &smtp.FromName,
			&smtp.Encryption, &smtp.Enabled, &smtp.CreatedAt, &smtp.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return smtp, nil
}

func (s *Store) UpsertTenantSMTPSettings(ctx context.Context, smtp *models.TenantSMTPSettings) error {
	_, err := s.Pool.Exec(ctx,
		`INSERT INTO tenant_smtp_settings (tenant_id, host, port, username, password, from_email, from_name, encryption, enabled)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 ON CONFLICT (tenant_id) DO UPDATE SET
		   host=EXCLUDED.host, port=EXCLUDED.port, username=EXCLUDED.username, password=EXCLUDED.password,
		   from_email=EXCLUDED.from_email, from_name=EXCLUDED.from_name, encryption=EXCLUDED.encryption,
		   enabled=EXCLUDED.enabled`,
		smtp.TenantID, smtp.Host, smtp.Port, smtp.Username, smtp.Password, smtp.FromEmail, smtp.FromName,
		smtp.Encryption, smtp.Enabled)
	return err
}

// ---------------- Users / auth ----------------

func (s *Store) GetUserByEmail(ctx context.Context, tenantID *uuid.UUID, email string) (*models.User, error) {
	u := &models.User{}
	var tid *uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, full_name, role, is_active, phone, marketing_consent, admin_notes, last_login_at, created_at, updated_at
		 FROM users WHERE email=$1 AND (tenant_id IS NOT DISTINCT FROM $2)`, email, tenantID).
		Scan(&u.ID, &tid, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	u.TenantID = tid
	return u, nil
}

func (s *Store) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	u := &models.User{}
	var tid *uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, full_name, role, is_active, phone, marketing_consent, admin_notes, last_login_at, created_at, updated_at
		 FROM users WHERE id=$1`, id).
		Scan(&u.ID, &tid, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	u.TenantID = tid
	return u, nil
}

func (s *Store) CreateUser(ctx context.Context, u *models.User) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, created_at, updated_at`,
		u.TenantID, u.Email, u.PasswordHash, u.FullName, u.Role, u.IsActive).
		Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func (s *Store) ListTenantUsers(ctx context.Context, tenantID uuid.UUID) ([]models.User, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, email, password_hash, full_name, role, is_active, phone, marketing_consent, admin_notes, last_login_at, created_at, updated_at
		 FROM users WHERE tenant_id=$1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		var u models.User
		var tid *uuid.UUID
		if err := rows.Scan(&u.ID, &tid, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		u.TenantID = tid
		out = append(out, u)
	}
	return out, nil
}

// GetTenantUser gets a single user within a tenant (admin view).
func (s *Store) GetTenantUser(ctx context.Context, tenantID, userID uuid.UUID) (*models.User, error) {
	u := &models.User{}
	var tid *uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, full_name, role, is_active, phone, marketing_consent, admin_notes, last_login_at, created_at, updated_at
		 FROM users WHERE id=$1 AND tenant_id=$2`, userID, tenantID).
		Scan(&u.ID, &tid, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	u.TenantID = tid
	return u, nil
}

// UpdateUser updates a user's profile, role, and status (admin).
func (s *Store) UpdateUser(ctx context.Context, tenantID, userID uuid.UUID, fullName, phone, role, adminNotes string, isActive bool) (*models.User, error) {
	u := &models.User{}
	var tid *uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`UPDATE users SET full_name=$3, phone=$4, role=$5, admin_notes=$6, is_active=$7, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2
		 RETURNING id, tenant_id, email, password_hash, full_name, role, is_active, phone, marketing_consent, admin_notes, last_login_at, created_at, updated_at`,
		userID, tenantID, fullName, phone, role, adminNotes, isActive).
		Scan(&u.ID, &tid, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	u.TenantID = tid
	return u, nil
}

// SetUserActive activates or deactivates a user.
func (s *Store) SetUserActive(ctx context.Context, tenantID, userID uuid.UUID, active bool) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE users SET is_active=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, userID, tenantID, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ResetUserPassword sets a new password hash for a user (admin reset).
func (s *Store) ResetUserPassword(ctx context.Context, tenantID, userID uuid.UUID, passwordHash string) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE users SET password_hash=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, userID, tenantID, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteUserAdmin deletes a user from a tenant (admin action). Customers get
// the full GDPR anonymization treatment; staff/admin are simply removed.
func (s *Store) DeleteUserAdmin(ctx context.Context, tenantID, userID uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM users WHERE id=$1 AND tenant_id=$2`, userID, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UserStats returns role-based user counts for a tenant.
func (s *Store) UserStats(ctx context.Context, tenantID uuid.UUID) (*models.UserStats, error) {
	stats := &models.UserStats{}
	err := s.Pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1),
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND role='customer'),
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND role='staff'),
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND role='business_admin'),
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND is_active=TRUE),
			(SELECT COUNT(*) FROM users WHERE tenant_id=$1 AND is_active=FALSE)
		`, tenantID).
		Scan(&stats.Total, &stats.Customers, &stats.Staff, &stats.Admins, &stats.Active, &stats.Inactive)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

// ListAllUsers lists all users across all tenants (superadmin platform view).
func (s *Store) ListAllUsers(ctx context.Context) ([]models.User, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT u.id, u.tenant_id, u.email, u.password_hash, u.full_name, u.role, u.is_active, u.phone, u.marketing_consent, u.admin_notes, u.last_login_at, u.created_at, u.updated_at
		 FROM users u ORDER BY u.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.User
	for rows.Next() {
		var u models.User
		var tid *uuid.UUID
		if err := rows.Scan(&u.ID, &tid, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		u.TenantID = tid
		out = append(out, u)
	}
	return out, nil
}

// ---------------- Customer management (admin) ----------------

// CustomerFilter controls listing/searching customers.
type CustomerFilter struct {
	TenantID uuid.UUID
	Search   *string
	IsActive *bool
	Limit    int
	Offset   int
}

func (s *Store) ListCustomers(ctx context.Context, f CustomerFilter) ([]models.User, int, error) {
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 20
	}
	var (
		conds  []string
		args   []interface{}
		argIdx = 1
	)
	conds = append(conds, fmt.Sprintf("tenant_id = $%d", argIdx), "role = 'customer'")
	args = append(args, f.TenantID)
	argIdx++

	if f.Search != nil && *f.Search != "" {
		conds = append(conds, fmt.Sprintf("(email ILIKE $%d OR full_name ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+*f.Search+"%")
		argIdx++
	}
	if f.IsActive != nil {
		conds = append(conds, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *f.IsActive)
		argIdx++
	}

	where := strings.Join(conds, " AND ")

	var total int
	if err := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM users WHERE %s`, where), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q := fmt.Sprintf(`SELECT id, tenant_id, email, password_hash, full_name, role, is_active, phone, marketing_consent, admin_notes, last_login_at, created_at, updated_at
		FROM users WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		var tid *uuid.UUID
		if err := rows.Scan(&u.ID, &tid, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, 0, err
		}
		u.TenantID = tid
		out = append(out, u)
	}
	return out, total, nil
}

// GetCustomerDetail returns a customer with aggregated order stats and addresses.
func (s *Store) GetCustomerDetail(ctx context.Context, tenantID, userID uuid.UUID) (*models.CustomerDetail, error) {
	u, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.TenantID == nil || *u.TenantID != tenantID {
		return nil, sql.ErrNoRows
	}
	cd := &models.CustomerDetail{User: *u}

	// Order stats
	_ = s.Pool.QueryRow(ctx,
		`SELECT COUNT(*), COALESCE(SUM(grand_total), 0) FROM orders WHERE user_id=$1 AND tenant_id=$2 AND status NOT IN ('cancelled','refunded')`,
		userID, tenantID).Scan(&cd.OrderCount, &cd.TotalSpent)

	// Addresses
	rows, err := s.Pool.Query(ctx,
		`SELECT id, user_id, tenant_id, label, line1, line2, city, state, postal_code, country, phone, is_default, created_at
		 FROM addresses WHERE user_id=$1 AND tenant_id=$2 ORDER BY is_default DESC, created_at`,
		userID, tenantID)
	if err == nil {
		defer rows.Close()
		cd.Addresses = make([]models.Address, 0)
		for rows.Next() {
			var a models.Address
			if err := rows.Scan(&a.ID, &a.UserID, &a.TenantID, &a.Label, &a.Line1, &a.Line2, &a.City, &a.State, &a.PostalCode, &a.Country, &a.Phone, &a.IsDefault, &a.CreatedAt); err == nil {
				cd.Addresses = append(cd.Addresses, a)
			}
		}
	}

	return cd, nil
}

// UpdateCustomer updates a customer's profile fields (admin-managed).
func (s *Store) UpdateCustomer(ctx context.Context, tenantID, userID uuid.UUID, fullName, phone string, isActive, marketingConsent bool, adminNotes string) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE users SET full_name=$1, phone=$2, is_active=$3, marketing_consent=$4, admin_notes=$5, updated_at=NOW()
		 WHERE id=$6 AND tenant_id=$7 AND role='customer'`,
		fullName, phone, isActive, marketingConsent, adminNotes, userID, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteCustomerAdmin hard-deletes a customer (admin action, distinct from GDPR self-deletion).
func (s *Store) DeleteCustomerAdmin(ctx context.Context, tenantID, userID uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx,
		`DELETE FROM users WHERE id=$1 AND tenant_id=$2 AND role='customer'`,
		userID, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CustomerStats returns aggregate customer statistics for the backoffice.
func (s *Store) CustomerStats(ctx context.Context, tenantID uuid.UUID, dr DateRangeFilter) (*models.CustomerStats, error) {
	stats := &models.CustomerStats{}

	// Total + active customers (not date-scoped — these are cumulative counts)
	s.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FILTER (WHERE u.role='customer'),
		        COUNT(*) FILTER (WHERE u.role='customer' AND u.is_active=TRUE)
		 FROM users u WHERE u.tenant_id=$1`, tenantID).
		Scan(&stats.TotalCustomers, &stats.ActiveCustomers)

	// New-this-month: scoped to date range "from" if provided, else current month
	newFrom := dr.From
	newTo := dr.To
	var newArgs []interface{}
	newArgs = append(newArgs, tenantID)
	argIdx := 2
	var newClause string
	if newFrom != "" {
		newClause += fmt.Sprintf(" AND u.created_at >= $%d", argIdx)
		newArgs = append(newArgs, newFrom)
		argIdx++
	} else {
		newClause += fmt.Sprintf(" AND u.created_at >= date_trunc('month', NOW())")
	}
	if newTo != "" {
		newClause += fmt.Sprintf(" AND u.created_at <= $%d", argIdx)
		newArgs = append(newArgs, newTo)
		argIdx++
	}
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM users u WHERE u.role='customer' AND u.tenant_id=$1%s`, newClause),
		newArgs...).Scan(&stats.NewThisMonth)

	// Total spent + avg order value scoped to date range
	revArgs := []interface{}{tenantID}
	revIdx := 2
	revClause, revArgs, revIdx := dateRangeClause("o.created_at", dr, revArgs, revIdx)
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COALESCE(SUM(o.grand_total), 0), COALESCE(AVG(o.grand_total), 0)
		 FROM users u
		 LEFT JOIN orders o ON o.user_id = u.id AND o.tenant_id = u.tenant_id AND o.status NOT IN ('cancelled','refunded')
		 WHERE u.tenant_id=$1%s`, revClause),
		revArgs...).Scan(&stats.TotalSpent, &stats.AvgOrderValue)

	return stats, nil
}

// UpdateLastLoginAt records the user's last login timestamp.
func (s *Store) UpdateLastLoginAt(ctx context.Context, userID uuid.UUID) {
	_, _ = s.Pool.Exec(ctx, `UPDATE users SET last_login_at=NOW() WHERE id=$1`, userID)
}

// GetSuperAdmin returns the platform superadmin if one exists.
func (s *Store) GetSuperAdmin(ctx context.Context) (*models.User, error) {
	u := &models.User{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, password_hash, full_name, role, is_active, phone, marketing_consent, admin_notes, last_login_at, created_at, updated_at
		 FROM users WHERE role='superadmin' LIMIT 1`).
		Scan(&u.ID, &u.TenantID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone, &u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// ---------------- GDPR: Data export & account deletion ----------------

// ExportUserData collects all personal data for a user (GDPR Art. 15 — Right of access / Art. 20 — Portability).
// Returns a map of data categories that can be serialized to JSON.
func (s *Store) ExportUserData(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	result := make(map[string]interface{})

	// 1. User profile
	var u models.User
	var tenantID *uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, email, full_name, role, is_active, created_at, updated_at
		 FROM users WHERE id=$1`, userID).
		Scan(&u.ID, &tenantID, &u.Email, &u.FullName, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	u.TenantID = tenantID
	// Exclude password_hash from export
	result["profile"] = map[string]interface{}{
		"id":         u.ID,
		"email":      u.Email,
		"full_name":  u.FullName,
		"role":       u.Role,
		"is_active":  u.IsActive,
		"created_at": u.CreatedAt,
		"updated_at": u.UpdatedAt,
	}

	// 2. Addresses
	addrRows, err := s.Pool.Query(ctx,
		`SELECT id, label, line1, line2, city, state, postal_code, country, phone, is_default, created_at
		 FROM addresses WHERE user_id=$1 ORDER BY created_at`, userID)
	if err == nil {
		var addresses []map[string]interface{}
		for addrRows.Next() {
			var a struct {
				ID         uuid.UUID `json:"id"`
				Label      string    `json:"label"`
				Line1      string    `json:"line1"`
				Line2      *string   `json:"line2"`
				City       string    `json:"city"`
				State      *string   `json:"state"`
				PostalCode *string   `json:"postal_code"`
				Country    string    `json:"country"`
				Phone      *string   `json:"phone"`
				IsDefault  bool      `json:"is_default"`
				CreatedAt  time.Time `json:"created_at"`
			}
			if err := addrRows.Scan(&a.ID, &a.Label, &a.Line1, &a.Line2, &a.City, &a.State, &a.PostalCode, &a.Country, &a.Phone, &a.IsDefault, &a.CreatedAt); err == nil {
				addresses = append(addresses, map[string]interface{}{
					"id":          a.ID,
					"label":       a.Label,
					"line1":       a.Line1,
					"line2":       a.Line2,
					"city":        a.City,
					"state":       a.State,
					"postal_code": a.PostalCode,
					"country":     a.Country,
					"phone":       a.Phone,
					"is_default":  a.IsDefault,
					"created_at":  a.CreatedAt,
				})
			}
		}
		addrRows.Close()
		result["addresses"] = addresses
	}

	// 3. Orders
	orderRows, err := s.Pool.Query(ctx,
		`SELECT id, status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency_code, created_at
		 FROM orders WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err == nil {
		var orders []map[string]interface{}
		for orderRows.Next() {
			var o struct {
				ID            uuid.UUID `json:"id"`
				Status        string    `json:"status"`
				Subtotal      float64   `json:"subtotal"`
				DiscountTotal float64   `json:"discount_total"`
				ShippingTotal float64   `json:"shipping_total"`
				TaxTotal      float64   `json:"tax_total"`
				GrandTotal    float64   `json:"grand_total"`
				CurrencyCode  string    `json:"currency_code"`
				CreatedAt     time.Time `json:"created_at"`
			}
			if err := orderRows.Scan(&o.ID, &o.Status, &o.Subtotal, &o.DiscountTotal, &o.ShippingTotal, &o.TaxTotal, &o.GrandTotal, &o.CurrencyCode, &o.CreatedAt); err == nil {
				orders = append(orders, map[string]interface{}{
					"id":             o.ID,
					"status":         o.Status,
					"subtotal":       o.Subtotal,
					"discount_total": o.DiscountTotal,
					"shipping_total": o.ShippingTotal,
					"tax_total":      o.TaxTotal,
					"grand_total":    o.GrandTotal,
					"currency_code":  o.CurrencyCode,
					"created_at":     o.CreatedAt,
				})
			}
		}
		orderRows.Close()
		result["orders"] = orders
	}

	// 4. Wishlist
	wishlistRows, err := s.Pool.Query(ctx,
		`SELECT wi.product_id, p.name, wi.created_at
		 FROM wishlists w
		 JOIN wishlist_items wi ON wi.wishlist_id = w.id
		 JOIN products p ON p.id = wi.product_id
		 WHERE w.user_id=$1 ORDER BY wi.created_at DESC`, userID)
	if err == nil {
		var wishlist []map[string]interface{}
		for wishlistRows.Next() {
			var w struct {
				ProductID uuid.UUID `json:"product_id"`
				Name      string    `json:"name"`
				CreatedAt time.Time `json:"created_at"`
			}
			if err := wishlistRows.Scan(&w.ProductID, &w.Name, &w.CreatedAt); err == nil {
				wishlist = append(wishlist, map[string]interface{}{
					"product_id": w.ProductID,
					"name":       w.Name,
					"created_at": w.CreatedAt,
				})
			}
		}
		wishlistRows.Close()
		result["wishlist"] = wishlist
	}

	// 5. Reviews
	reviewRows, err := s.Pool.Query(ctx,
		`SELECT id, product_id, rating, title, body, is_verified, is_approved, created_at
		 FROM product_reviews WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err == nil {
		var reviews []map[string]interface{}
		for reviewRows.Next() {
			var r struct {
				ID         uuid.UUID `json:"id"`
				ProductID  uuid.UUID `json:"product_id"`
				Rating     int       `json:"rating"`
				Title      string    `json:"title"`
				Body       string    `json:"body"`
				IsVerified bool      `json:"is_verified"`
				IsApproved bool      `json:"is_approved"`
				CreatedAt  time.Time `json:"created_at"`
			}
			if err := reviewRows.Scan(&r.ID, &r.ProductID, &r.Rating, &r.Title, &r.Body, &r.IsVerified, &r.IsApproved, &r.CreatedAt); err == nil {
				reviews = append(reviews, map[string]interface{}{
					"id":          r.ID,
					"product_id":  r.ProductID,
					"rating":      r.Rating,
					"title":       r.Title,
					"body":        r.Body,
					"is_verified": r.IsVerified,
					"is_approved": r.IsApproved,
					"created_at":  r.CreatedAt,
				})
			}
		}
		reviewRows.Close()
		result["reviews"] = reviews
	}

	result["exported_at"] = time.Now().UTC().Format(time.RFC3339)
	return result, nil
}

// DeleteUserAccount performs GDPR Art. 17 (Right to erasure / "right to be forgotten").
// It anonymizes the user's PII, deletes related personal data, and deactivates the account.
// Orders are retained (legally required for tax/accounting) but shipping/billing addresses
// in the order JSON are redacted. The user record is anonymized, not hard-deleted, to
// maintain referential integrity for historical orders.
func (s *Store) DeleteUserAccount(ctx context.Context, userID uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Delete addresses (full delete — PII)
	if _, err := tx.Exec(ctx, `DELETE FROM addresses WHERE user_id=$1`, userID); err != nil {
		return fmt.Errorf("failed to delete addresses: %w", err)
	}

	// 2. Delete wishlist (full delete)
	if _, err := tx.Exec(ctx, `DELETE FROM wishlists WHERE user_id=$1`, userID); err != nil {
		return fmt.Errorf("failed to delete wishlists: %w", err)
	}

	// 3. Anonymize reviews — keep rating/title/body for product display, remove user_id
	if _, err := tx.Exec(ctx,
		`UPDATE product_reviews SET user_id=NULL, author_name='Deleted User' WHERE user_id=$1`, userID); err != nil {
		return fmt.Errorf("failed to anonymize reviews: %w", err)
	}

	// 4. Redact shipping/billing addresses in orders (keep order data for tax compliance)
	if _, err := tx.Exec(ctx,
		`UPDATE orders SET
		   shipping_address = CASE
		     WHEN shipping_address IS NOT NULL
		     THEN jsonb_set(shipping_address, '{line1}', '"[REDACTED]"')::jsonb
		     - 'line2' - 'phone' - 'postal_code'
		   END,
		   billing_address = CASE
		     WHEN billing_address IS NOT NULL
		     THEN jsonb_set(billing_address, '{line1}', '"[REDACTED]"')::jsonb
		     - 'line2' - 'phone' - 'postal_code'
		   END
		 WHERE user_id=$1`, userID); err != nil {
		return fmt.Errorf("failed to redact order addresses: %w", err)
	}

	// 5. Anonymize the user record (keep for referential integrity, remove PII)
	anonEmail := fmt.Sprintf("deleted+%s@anonymized.local", userID.String()[:8])
	if _, err := tx.Exec(ctx,
		`UPDATE users SET
		   email=$2,
		   password_hash='',
		   full_name='Deleted User',
		   is_active=FALSE,
		   updated_at=NOW()
		 WHERE id=$1`, userID, anonEmail); err != nil {
		return fmt.Errorf("failed to anonymize user: %w", err)
	}

	// 6. Delete cart (personal data)
	if _, err := tx.Exec(ctx, `DELETE FROM carts WHERE user_id=$1`, userID); err != nil {
		return fmt.Errorf("failed to delete carts: %w", err)
	}

	return tx.Commit(ctx)
}

// ---------------- Currencies / languages ----------------

func (s *Store) ListCurrencies(ctx context.Context) ([]models.Currency, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, code, name, symbol, decimals, is_active FROM currencies WHERE is_active=TRUE ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Currency
	for rows.Next() {
		var c models.Currency
		if err := rows.Scan(&c.ID, &c.Code, &c.Name, &c.Symbol, &c.Decimals, &c.IsActive); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (s *Store) GetCurrencyByCode(ctx context.Context, code string) (*models.Currency, error) {
	c := &models.Currency{}
	err := s.Pool.QueryRow(ctx, `SELECT id, code, name, symbol, decimals, is_active FROM currencies WHERE code=$1`, code).
		Scan(&c.ID, &c.Code, &c.Name, &c.Symbol, &c.Decimals, &c.IsActive)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Store) ListLanguages(ctx context.Context) ([]models.Language, error) {
	rows, err := s.Pool.Query(ctx, `SELECT code, name, is_active FROM languages WHERE is_active=TRUE ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Language
	for rows.Next() {
		var l models.Language
		if err := rows.Scan(&l.Code, &l.Name, &l.IsActive); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, nil
}

// ---------------- Categories ----------------

func (s *Store) ListCategories(ctx context.Context, tenantID uuid.UUID) ([]models.Category, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, parent_id, slug, name, description, sort_order, is_active, meta_title, meta_description
		 FROM categories WHERE tenant_id=$1 ORDER BY sort_order, name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Category
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.TenantID, &c.ParentID, &c.Slug, &c.Name, &c.Description, &c.SortOrder, &c.IsActive, &c.MetaTitle, &c.MetaDescription); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func (s *Store) CreateCategory(ctx context.Context, c *models.Category) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO categories (tenant_id, parent_id, slug, name, description, sort_order, is_active, meta_title, meta_description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING id, created_at, updated_at`,
		c.TenantID, c.ParentID, c.Slug, c.Name, c.Description, c.SortOrder, c.IsActive, c.MetaTitle, c.MetaDescription).
		Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (s *Store) UpdateCategory(ctx context.Context, c *models.Category) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE categories SET parent_id=$2, slug=$3, name=$4, description=$5, sort_order=$6, is_active=$7, meta_title=$8, meta_description=$9
		 WHERE id=$1 AND tenant_id=$10`,
		c.ID, c.ParentID, c.Slug, c.Name, c.Description, c.SortOrder, c.IsActive, c.MetaTitle, c.MetaDescription, c.TenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) DeleteCategory(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM categories WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ---------------- Attributes ----------------

func (s *Store) ListAttributes(ctx context.Context, tenantID uuid.UUID) ([]models.Attribute, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, slug, name, type, is_filterable, is_variant FROM attributes WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Attribute
	for rows.Next() {
		var a models.Attribute
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Slug, &a.Name, &a.Type, &a.IsFilterable, &a.IsVariant); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	// load options
	for i := range out {
		opts, err := s.listAttributeOptions(ctx, out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].Options = opts
	}
	return out, nil
}

func (s *Store) listAttributeOptions(ctx context.Context, attrID uuid.UUID) ([]models.AttributeOption, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, attribute_id, value, label, sort_order FROM attribute_options WHERE attribute_id=$1 ORDER BY sort_order`, attrID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.AttributeOption
	for rows.Next() {
		var o models.AttributeOption
		if err := rows.Scan(&o.ID, &o.AttributeID, &o.Value, &o.Label, &o.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, nil
}

func (s *Store) CreateAttribute(ctx context.Context, a *models.Attribute) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := tx.QueryRow(ctx,
		`INSERT INTO attributes (tenant_id, slug, name, type, is_filterable, is_variant)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		a.TenantID, a.Slug, a.Name, a.Type, a.IsFilterable, a.IsVariant).Scan(&a.ID); err != nil {
		return err
	}
	for _, o := range a.Options {
		if _, err := tx.Exec(ctx,
			`INSERT INTO attribute_options (attribute_id, value, label, sort_order) VALUES ($1,$2,$3,$4)
			 ON CONFLICT (attribute_id, value) DO UPDATE SET label=EXCLUDED.label, sort_order=EXCLUDED.sort_order`,
			a.ID, o.Value, o.Label, o.SortOrder); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteAttribute(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM attributes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UpdateAttribute updates an attribute's metadata and syncs its options (delete+reinsert).
func (s *Store) UpdateAttribute(ctx context.Context, a *models.Attribute) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`UPDATE attributes SET slug=$2, name=$3, type=$4, is_filterable=$5, is_variant=$6
		 WHERE id=$1 AND tenant_id=$7`,
		a.ID, a.Slug, a.Name, a.Type, a.IsFilterable, a.IsVariant, a.TenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}

	// Sync options: delete old, insert new
	if _, err := tx.Exec(ctx, `DELETE FROM attribute_options WHERE attribute_id=$1`, a.ID); err != nil {
		return err
	}
	for _, o := range a.Options {
		if _, err := tx.Exec(ctx,
			`INSERT INTO attribute_options (attribute_id, value, label, sort_order) VALUES ($1,$2,$3,$4)`,
			a.ID, o.Value, o.Label, o.SortOrder); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// ---------------- Products ----------------

type ProductFilter struct {
	TenantID    uuid.UUID
	CategorySlug *string
	Search      *string
	AttributeFilters map[string][]string // attr slug -> option values
	MinPrice    *float64
	MaxPrice    *float64
	FeaturedOnly bool
	ExcludeProductID *uuid.UUID // exclude a specific product (e.g. for "similar products")
	ProductIDs  []uuid.UUID // filter to specific product IDs (e.g. for page builder product picker)
	Status      string // admin: filter by explicit status (overrides IncludeAll default)
	Limit       int
	Offset      int
	Language    string
	IncludeAll  bool // admin: include all statuses (not just active)
}

func (s *Store) ListProducts(ctx context.Context, f ProductFilter) ([]models.Product, int, error) {
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 24
	}
	var (
		conds  []string
		args   []interface{}
		argIdx = 1
	)
	conds = append(conds, fmt.Sprintf("p.tenant_id = $%d", argIdx))
	args = append(args, f.TenantID)
	argIdx++

	// Admin sees all statuses; public storefront only sees active.
	// If Status is set explicitly (admin filter), use it instead.
	if f.Status != "" {
		conds = append(conds, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, f.Status)
		argIdx++
	} else if !f.IncludeAll {
		conds = append(conds, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, "active")
		argIdx++
	}

	if f.CategorySlug != nil && *f.CategorySlug != "" {
		conds = append(conds, fmt.Sprintf("c.slug = $%d", argIdx))
		args = append(args, *f.CategorySlug)
		argIdx++
	}
	if f.Search != nil && *f.Search != "" {
		conds = append(conds, fmt.Sprintf("(p.name ILIKE $%d OR p.description ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+*f.Search+"%")
		argIdx++
	}
	if f.MinPrice != nil {
		conds = append(conds, fmt.Sprintf("p.base_price >= $%d", argIdx))
		args = append(args, *f.MinPrice)
		argIdx++
	}
	if f.MaxPrice != nil {
		conds = append(conds, fmt.Sprintf("p.base_price <= $%d", argIdx))
		args = append(args, *f.MaxPrice)
		argIdx++
	}
	if f.FeaturedOnly {
		conds = append(conds, "p.is_featured = TRUE")
	}
	if f.ExcludeProductID != nil {
		conds = append(conds, fmt.Sprintf("p.id <> $%d", argIdx))
		args = append(args, *f.ExcludeProductID)
		argIdx++
	}
	if len(f.ProductIDs) > 0 {
		placeholders := make([]string, len(f.ProductIDs))
		for i, pid := range f.ProductIDs {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, pid)
			argIdx++
		}
		conds = append(conds, fmt.Sprintf("p.id IN (%s)", strings.Join(placeholders, ",")))
	}

	where := strings.Join(conds, " AND ")

	// attribute filters via EXISTS subqueries
	for slug, vals := range f.AttributeFilters {
		if len(vals) == 0 {
			continue
		}
		placeholders := make([]string, len(vals))
		for i, v := range vals {
			placeholders[i] = fmt.Sprintf("$%d", argIdx)
			args = append(args, v)
			argIdx++
		}
		conds2 := fmt.Sprintf(`EXISTS (
			SELECT 1 FROM product_attribute_values pav
			JOIN attributes a ON a.id = pav.attribute_id
			JOIN attribute_options o ON o.id = pav.option_id
			WHERE pav.product_id = p.id AND a.slug = $%d AND o.value IN (%s))
		OR EXISTS (
			SELECT 1 FROM variants v
			JOIN variant_attribute_values vav ON vav.variant_id = v.id
			JOIN attributes a ON a.id = vav.attribute_id
			JOIN attribute_options o ON o.id = vav.option_id
			WHERE v.product_id = p.id AND a.slug = $%d AND o.value IN (%s))`, argIdx, strings.Join(placeholders, ","), argIdx, strings.Join(placeholders, ","))
		args = append(args, slug)
		argIdx++
		where += " AND " + conds2
	}

	// count
	var total int
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE %s`, where)
	if err := s.Pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q := fmt.Sprintf(`SELECT p.id, p.tenant_id, p.category_id, c.slug, p.slug, p.name, p.description, p.sku,
		p.status, p.base_price, cur.code, p.is_featured, p.rating, p.stock, p.low_stock_threshold, p.track_inventory, p.requires_shipping, p.weight, p.length, p.width, p.height, p.free_shipping, p.vendor_id, p.image_url, p.tax_class_id, p.created_at, p.updated_at,
		p.return_period_days, p.refund_period_days, p.replacement_period_days,
		p.return_enabled, p.refund_enabled, p.replacement_enabled,
		p.meta_title, p.meta_description, p.og_image
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN currencies cur ON cur.id = p.currency_id
		WHERE %s
		ORDER BY p.is_featured DESC, p.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []models.Product
	for rows.Next() {
		var p models.Product
		var catSlug *string
		if err := rows.Scan(&p.ID, &p.TenantID, &p.CategoryID, &catSlug, &p.Slug, &p.Name, &p.Description,
			&p.SKU, &p.Status, &p.BasePrice, &p.CurrencyCode, &p.IsFeatured, &p.Rating, &p.Stock, &p.LowStockThreshold, &p.TrackInventory, &p.RequiresShipping, &p.Weight, &p.Length, &p.Width, &p.Height, &p.FreeShipping, &p.VendorID, &p.ImageURL,
			&p.TaxClassID, &p.CreatedAt, &p.UpdatedAt, &p.ReturnPeriodDays, &p.RefundPeriodDays, &p.ReplacementPeriodDays,
			&p.ReturnEnabled, &p.RefundEnabled, &p.ReplacementEnabled,
			&p.MetaTitle, &p.MetaDescription, &p.OGImage); err != nil {
			return nil, 0, err
		}
		if catSlug != nil {
			p.CategorySlug = *catSlug
		}
		// translated name if non-default language requested
		if f.Language != "" && f.Language != "en" {
			var name, desc *string
			s.Pool.QueryRow(ctx, `SELECT name, description FROM product_translations WHERE product_id=$1 AND language=$2`, p.ID, f.Language).Scan(&name, &desc)
			if name != nil && *name != "" {
				p.Name = *name
			}
			if desc != nil && *desc != "" {
				p.Description = *desc
			}
		}
		out = append(out, p)
	}
	return out, total, nil
}

func (s *Store) GetProductBySlug(ctx context.Context, tenantID uuid.UUID, slug, language string) (*models.Product, error) {
	p := &models.Product{}
	var catSlug *string
	err := s.Pool.QueryRow(ctx,
		`SELECT p.id, p.tenant_id, p.category_id, c.slug, p.slug, p.name, p.description, p.sku,
		 p.status, p.base_price, cur.code, p.is_featured, p.rating, p.stock, p.low_stock_threshold, p.track_inventory, p.requires_shipping, p.weight, p.length, p.width, p.height, p.free_shipping, p.vendor_id, p.image_url, p.tax_class_id, p.created_at, p.updated_at,
		 p.return_period_days, p.refund_period_days, p.replacement_period_days,
		 p.return_enabled, p.refund_enabled, p.replacement_enabled,
		 p.meta_title, p.meta_description, p.og_image
		 FROM products p
		 LEFT JOIN categories c ON c.id = p.category_id
		 LEFT JOIN currencies cur ON cur.id = p.currency_id
		 WHERE p.tenant_id=$1 AND p.slug=$2`, tenantID, slug).
		Scan(&p.ID, &p.TenantID, &p.CategoryID, &catSlug, &p.Slug, &p.Name, &p.Description,
			&p.SKU, &p.Status, &p.BasePrice, &p.CurrencyCode, &p.IsFeatured, &p.Rating, &p.Stock, &p.LowStockThreshold, &p.TrackInventory, &p.RequiresShipping, &p.Weight, &p.Length, &p.Width, &p.Height, &p.FreeShipping, &p.VendorID, &p.ImageURL,
			&p.TaxClassID, &p.CreatedAt, &p.UpdatedAt, &p.ReturnPeriodDays, &p.RefundPeriodDays, &p.ReplacementPeriodDays,
			&p.ReturnEnabled, &p.RefundEnabled, &p.ReplacementEnabled,
			&p.MetaTitle, &p.MetaDescription, &p.OGImage)
	if err != nil {
		return nil, err
	}
	if catSlug != nil {
		p.CategorySlug = *catSlug
	}
	if language != "" && language != "en" {
		var name, desc *string
		s.Pool.QueryRow(ctx, `SELECT name, description FROM product_translations WHERE product_id=$1 AND language=$2`, p.ID, language).Scan(&name, &desc)
		if name != nil && *name != "" {
			p.Name = *name
		}
		if desc != nil && *desc != "" {
			p.Description = *desc
		}
	}
	variants, err := s.listVariants(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Variants = variants
	attrs, err := s.listProductAttributes(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Attributes = attrs
	images, err := s.listProductImages(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Images = images
	return p, nil
}

func (s *Store) listProductImages(ctx context.Context, productID uuid.UUID) ([]models.ProductImage, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, product_id, url, alt, sort_order FROM product_images WHERE product_id=$1 ORDER BY sort_order`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ProductImage
	for rows.Next() {
		var img models.ProductImage
		if err := rows.Scan(&img.ID, &img.ProductID, &img.URL, &img.Alt, &img.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	return out, nil
}

// EnrichProducts populates Images, Variants, and Attributes for a slice of
// products. Used by the public storefront listing so cards/detail previews
// have images and variant pricing without a separate fetch per product.
func (s *Store) EnrichProducts(ctx context.Context, products []models.Product) {
	for i := range products {
		p := &products[i]
		p.Images, _ = s.listProductImages(ctx, p.ID)
		p.Variants, _ = s.listVariants(ctx, p.ID)
		p.Attributes, _ = s.listProductAttributes(ctx, p.ID)
	}
}

func (s *Store) listVariants(ctx context.Context, productID uuid.UUID) ([]models.Variant, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, product_id, sku, name, price, stock, image_url, is_active FROM variants WHERE product_id=$1 ORDER BY created_at`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Variant
	for rows.Next() {
		var v models.Variant
		if err := rows.Scan(&v.ID, &v.ProductID, &v.SKU, &v.Name, &v.Price, &v.Stock, &v.ImageURL, &v.IsActive); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	for i := range out {
		vas, err := s.listVariantAttrs(ctx, out[i].ID)
		if err != nil {
			return nil, err
		}
		out[i].Attributes = vas
	}
	return out, nil
}

func (s *Store) listVariantAttrs(ctx context.Context, variantID uuid.UUID) ([]models.VariantAttr, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT a.slug, a.name, o.value, o.label FROM variant_attribute_values vav
		 JOIN attributes a ON a.id = vav.attribute_id
		 JOIN attribute_options o ON o.id = vav.option_id
		 WHERE vav.variant_id=$1`, variantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.VariantAttr
	for rows.Next() {
		var va models.VariantAttr
		if err := rows.Scan(&va.AttributeSlug, &va.AttributeName, &va.OptionValue, &va.OptionLabel); err != nil {
			return nil, err
		}
		out = append(out, va)
	}
	return out, nil
}

func (s *Store) listProductAttributes(ctx context.Context, productID uuid.UUID) ([]models.ProductAttributeValue, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT a.id, a.slug, a.name, pav.value_text, pav.value_number, pav.value_bool, pav.option_id, o.label
		 FROM product_attribute_values pav
		 JOIN attributes a ON a.id = pav.attribute_id
		 LEFT JOIN attribute_options o ON o.id = pav.option_id
		 WHERE pav.product_id=$1`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ProductAttributeValue
	for rows.Next() {
		var v models.ProductAttributeValue
		if err := rows.Scan(&v.AttributeID, &v.AttributeSlug, &v.AttributeName, &v.ValueText, &v.ValueNumber, &v.ValueBool, &v.OptionID, &v.OptionLabel); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, nil
}

func (s *Store) CreateProduct(ctx context.Context, p *models.Product) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var curID *uuid.UUID
	if p.CurrencyCode != "" {
		if err := tx.QueryRow(ctx, `SELECT id FROM currencies WHERE code=$1`, p.CurrencyCode).Scan(&curID); err != nil {
			return err
		}
	}
	if err := tx.QueryRow(ctx,
		`INSERT INTO products (tenant_id, category_id, slug, name, description, sku, status, base_price, currency_id, is_featured, stock, low_stock_threshold, track_inventory, requires_shipping, weight, length, width, height, free_shipping, vendor_id, image_url, tax_class_id, return_period_days, refund_period_days, replacement_period_days, return_enabled, refund_enabled, replacement_enabled, meta_title, meta_description, og_image)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
		 RETURNING id, created_at, updated_at`,
		p.TenantID, p.CategoryID, p.Slug, p.Name, p.Description, p.SKU, p.Status, p.BasePrice, curID, p.IsFeatured, p.Stock, p.LowStockThreshold, p.TrackInventory, p.RequiresShipping, p.Weight, p.Length, p.Width, p.Height, p.FreeShipping, p.VendorID, p.ImageURL, p.TaxClassID, p.ReturnPeriodDays, p.RefundPeriodDays, p.ReplacementPeriodDays, p.ReturnEnabled, p.RefundEnabled, p.ReplacementEnabled, p.MetaTitle, p.MetaDescription, p.OGImage).
		Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return err
	}
	// attribute values
	for _, av := range p.Attributes {
		var optID *uuid.UUID
		if av.OptionID != nil {
			optID = av.OptionID
		} else if av.ValueText != nil {
			// try to match an option by value for select/color attributes
			_ = tx.QueryRow(ctx, `SELECT id FROM attribute_options WHERE attribute_id=$1 AND value=$2`, av.AttributeID, *av.ValueText).Scan(&optID)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO product_attribute_values (product_id, attribute_id, value_text, value_number, value_bool, option_id)
			 VALUES ($1,$2,$3,$4,$5,$6)
			 ON CONFLICT (product_id, attribute_id) DO UPDATE SET value_text=EXCLUDED.value_text, value_number=EXCLUDED.value_number, value_bool=EXCLUDED.value_bool, option_id=EXCLUDED.option_id`,
			p.ID, av.AttributeID, av.ValueText, av.ValueNumber, av.ValueBool, optID); err != nil {
			return err
		}
	}
	// product images
	for _, img := range p.Images {
		if _, err := tx.Exec(ctx,
			`INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1,$2,$3,$4)`,
			p.ID, img.URL, img.Alt, img.SortOrder); err != nil {
			return err
		}
	}
	// variants
	for _, v := range p.Variants {
		if err := tx.QueryRow(ctx,
			`INSERT INTO variants (product_id, sku, name, price, stock, image_url, is_active)
			 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
			p.ID, v.SKU, v.Name, v.Price, v.Stock, v.ImageURL, v.IsActive).Scan(&v.ID); err != nil {
			return err
		}
		for _, va := range v.Attributes {
			var optID uuid.UUID
			if err := tx.QueryRow(ctx, `SELECT o.id FROM attribute_options o JOIN attributes a ON a.id=o.attribute_id WHERE a.tenant_id=$1 AND a.slug=$2 AND o.value=$3`,
				p.TenantID, va.AttributeSlug, va.OptionValue).Scan(&optID); err != nil {
				return fmt.Errorf("variant attr option not found: %s=%s: %w", va.AttributeSlug, va.OptionValue, err)
			}
			var attrID uuid.UUID
			if err := tx.QueryRow(ctx, `SELECT id FROM attributes WHERE tenant_id=$1 AND slug=$2`, p.TenantID, va.AttributeSlug).Scan(&attrID); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `INSERT INTO variant_attribute_values (variant_id, attribute_id, option_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, v.ID, attrID, optID); err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) UpdateProduct(ctx context.Context, p *models.Product) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Update the product row
	tag, err := tx.Exec(ctx,
		`UPDATE products SET category_id=$2, slug=$3, name=$4, description=$5, sku=$6, status=$7,
		 base_price=$8, is_featured=$9, stock=$10, low_stock_threshold=$11, track_inventory=$12, requires_shipping=$13,
		 weight=$14, length=$15, width=$16, height=$17, free_shipping=$18,
		 vendor_id=$19, image_url=$20, tax_class_id=$21,
		 return_period_days=$22, refund_period_days=$23, replacement_period_days=$24,
		 return_enabled=$25, refund_enabled=$26, replacement_enabled=$27,
		 meta_title=$28, meta_description=$29, og_image=$30
		 WHERE id=$1 AND tenant_id=$31`,
		p.ID, p.CategoryID, p.Slug, p.Name, p.Description, p.SKU, p.Status, p.BasePrice, p.IsFeatured, p.Stock, p.LowStockThreshold, p.TrackInventory, p.RequiresShipping,
		p.Weight, p.Length, p.Width, p.Height, p.FreeShipping,
		p.VendorID, p.ImageURL, p.TaxClassID, p.ReturnPeriodDays, p.RefundPeriodDays, p.ReplacementPeriodDays, p.ReturnEnabled, p.RefundEnabled, p.ReplacementEnabled, p.MetaTitle, p.MetaDescription, p.OGImage, p.TenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}

	// Sync product attribute values: delete old, insert new
	if _, err := tx.Exec(ctx, `DELETE FROM product_attribute_values WHERE product_id=$1`, p.ID); err != nil {
		return err
	}
	for _, av := range p.Attributes {
		var optID *uuid.UUID
		if av.OptionID != nil {
			optID = av.OptionID
		} else if av.ValueText != nil {
			_ = tx.QueryRow(ctx, `SELECT id FROM attribute_options WHERE attribute_id=$1 AND value=$2`, av.AttributeID, *av.ValueText).Scan(&optID)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO product_attribute_values (product_id, attribute_id, value_text, value_number, value_bool, option_id)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			p.ID, av.AttributeID, av.ValueText, av.ValueNumber, av.ValueBool, optID); err != nil {
			return err
		}
	}

	// Sync product images: delete old, insert new
	if _, err := tx.Exec(ctx, `DELETE FROM product_images WHERE product_id=$1`, p.ID); err != nil {
		return err
	}
	for _, img := range p.Images {
		if _, err := tx.Exec(ctx,
			`INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1,$2,$3,$4)`,
			p.ID, img.URL, img.Alt, img.SortOrder); err != nil {
			return err
		}
	}

	// Sync variants: delete old (cascades to variant_attribute_values), insert new
	if _, err := tx.Exec(ctx, `DELETE FROM variants WHERE product_id=$1`, p.ID); err != nil {
		return err
	}
	for _, v := range p.Variants {
		if err := tx.QueryRow(ctx,
			`INSERT INTO variants (product_id, sku, name, price, stock, image_url, is_active)
			 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
			p.ID, v.SKU, v.Name, v.Price, v.Stock, v.ImageURL, v.IsActive).Scan(&v.ID); err != nil {
			return err
		}
		for _, va := range v.Attributes {
			var optID uuid.UUID
			if err := tx.QueryRow(ctx, `SELECT o.id FROM attribute_options o JOIN attributes a ON a.id=o.attribute_id WHERE a.tenant_id=$1 AND a.slug=$2 AND o.value=$3`,
				p.TenantID, va.AttributeSlug, va.OptionValue).Scan(&optID); err != nil {
				return fmt.Errorf("variant attr option not found: %s=%s: %w", va.AttributeSlug, va.OptionValue, err)
			}
			var attrID uuid.UUID
			if err := tx.QueryRow(ctx, `SELECT id FROM attributes WHERE tenant_id=$1 AND slug=$2`, p.TenantID, va.AttributeSlug).Scan(&attrID); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, `INSERT INTO variant_attribute_values (variant_id, attribute_id, option_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, v.ID, attrID, optID); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (s *Store) DeleteProduct(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM products WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetProductByID fetches a single product by ID with all related data (variants, attributes, images).
// Used by the backoffice for editing products regardless of status.
func (s *Store) GetProductByID(ctx context.Context, tenantID, id uuid.UUID) (*models.Product, error) {
	var p models.Product
	var curID *uuid.UUID
	var catSlug *string
	err := s.Pool.QueryRow(ctx,
		`SELECT p.id, p.tenant_id, p.category_id, c.slug, p.slug, p.name, p.description, p.sku,
		        p.status, p.base_price, cur.code, p.is_featured, p.rating, p.stock, p.low_stock_threshold, p.track_inventory, p.requires_shipping, p.weight, p.length, p.width, p.height, p.free_shipping, p.vendor_id, p.image_url, p.tax_class_id, p.created_at, p.updated_at,
		        p.return_period_days, p.refund_period_days, p.replacement_period_days,
		        p.return_enabled, p.refund_enabled, p.replacement_enabled,
		        p.meta_title, p.meta_description, p.og_image
		 FROM products p
		 LEFT JOIN categories c ON c.id = p.category_id
		 LEFT JOIN currencies cur ON cur.id = p.currency_id
		 WHERE p.id=$1 AND p.tenant_id=$2`, id, tenantID).
		Scan(&p.ID, &p.TenantID, &p.CategoryID, &catSlug, &p.Slug, &p.Name, &p.Description,
			&p.SKU, &p.Status, &p.BasePrice, &p.CurrencyCode, &p.IsFeatured, &p.Rating, &p.Stock, &p.LowStockThreshold, &p.TrackInventory, &p.RequiresShipping, &p.Weight, &p.Length, &p.Width, &p.Height, &p.FreeShipping, &p.VendorID, &p.ImageURL,
			&p.TaxClassID, &p.CreatedAt, &p.UpdatedAt, &p.ReturnPeriodDays, &p.RefundPeriodDays, &p.ReplacementPeriodDays,
			&p.ReturnEnabled, &p.RefundEnabled, &p.ReplacementEnabled,
			&p.MetaTitle, &p.MetaDescription, &p.OGImage)
	if err != nil {
		return nil, err
	}
	_ = curID
	if catSlug != nil {
		p.CategorySlug = *catSlug
	}
	p.Images, _ = s.listProductImages(ctx, p.ID)
	p.Variants, _ = s.listVariants(ctx, p.ID)
	p.Attributes, _ = s.listProductAttributes(ctx, p.ID)
	return &p, nil
}

// ---------------- Offers ----------------

func (s *Store) ListOffers(ctx context.Context, tenantID uuid.UUID) ([]models.Offer, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, name, description, offer_type, value, starts_at, ends_at, is_active
		 FROM offers WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Offer
	for rows.Next() {
		var o models.Offer
		if err := rows.Scan(&o.ID, &o.TenantID, &o.Name, &o.Description, &o.OfferType, &o.Value, &o.StartsAt, &o.EndsAt, &o.IsActive); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	// Load targets for each offer
	for i := range out {
		out[i].Targets, _ = s.listOfferTargets(ctx, out[i].ID)
	}
	return out, nil
}

func (s *Store) listOfferTargets(ctx context.Context, offerID uuid.UUID) ([]models.OfferTarget, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT target_type, target_id FROM offer_targets WHERE offer_id=$1`, offerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.OfferTarget
	for rows.Next() {
		var t models.OfferTarget
		if err := rows.Scan(&t.TargetType, &t.TargetID); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

func (s *Store) GetOfferByID(ctx context.Context, tenantID, id uuid.UUID) (*models.Offer, error) {
	o := &models.Offer{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, description, offer_type, value, starts_at, ends_at, is_active
		 FROM offers WHERE id=$1 AND tenant_id=$2`, id, tenantID).
		Scan(&o.ID, &o.TenantID, &o.Name, &o.Description, &o.OfferType, &o.Value, &o.StartsAt, &o.EndsAt, &o.IsActive)
	if err != nil {
		return nil, err
	}
	o.Targets, _ = s.listOfferTargets(ctx, o.ID)
	return o, nil
}

func (s *Store) UpdateOffer(ctx context.Context, tenantID, id uuid.UUID, name, description, offerType string, value float64, startsAt, endsAt *time.Time, isActive bool, targets []models.OfferTarget) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx,
		`UPDATE offers SET name=$1, description=$2, offer_type=$3, value=$4, starts_at=$5, ends_at=$6, is_active=$7
		 WHERE id=$8 AND tenant_id=$9`,
		name, description, offerType, value, startsAt, endsAt, isActive, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	// Replace targets
	if _, err := tx.Exec(ctx, `DELETE FROM offer_targets WHERE offer_id=$1`, id); err != nil {
		return err
	}
	for _, t := range targets {
		if _, err := tx.Exec(ctx, `INSERT INTO offer_targets (offer_id, target_type, target_id) VALUES ($1,$2,$3)`, id, t.TargetType, t.TargetID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) CreateOffer(ctx context.Context, o *models.Offer) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := tx.QueryRow(ctx,
		`INSERT INTO offers (tenant_id, name, description, offer_type, value, starts_at, ends_at, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
		o.TenantID, o.Name, o.Description, o.OfferType, o.Value, o.StartsAt, o.EndsAt, o.IsActive).Scan(&o.ID); err != nil {
		return err
	}
	for _, t := range o.Targets {
		if _, err := tx.Exec(ctx, `INSERT INTO offer_targets (offer_id, target_type, target_id) VALUES ($1,$2,$3)`, o.ID, t.TargetType, t.TargetID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) DeleteOffer(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM offers WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ActiveOfferForProduct returns the best active percentage offer for a product.
func (s *Store) ActiveOfferForProduct(ctx context.Context, tenantID uuid.UUID, productID uuid.UUID, categoryID *uuid.UUID) (*models.Offer, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT o.id, o.tenant_id, o.name, o.description, o.offer_type, o.value, o.starts_at, o.ends_at, o.is_active
		 FROM offers o
		 JOIN offer_targets t ON t.offer_id = o.id
		 WHERE o.tenant_id=$1 AND o.is_active=TRUE
		   AND (o.starts_at IS NULL OR o.starts_at <= NOW())
		   AND (o.ends_at IS NULL OR o.ends_at >= NOW())
		   AND (
		     (t.target_type='all') OR
		     (t.target_type='product' AND t.target_id=$2) OR
		     (t.target_type='category' AND t.target_id IS NOT DISTINCT FROM $3)
		   )
		 ORDER BY o.value DESC`, tenantID, productID, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var best *models.Offer
	for rows.Next() {
		var o models.Offer
		if err := rows.Scan(&o.ID, &o.TenantID, &o.Name, &o.Description, &o.OfferType, &o.Value, &o.StartsAt, &o.EndsAt, &o.IsActive); err != nil {
			return nil, err
		}
		if best == nil || o.Value > best.Value {
			best = &o
		}
	}
	return best, nil
}

// ---------------- Discount codes ----------------

func (s *Store) ListDiscountCodes(ctx context.Context, tenantID uuid.UUID) ([]models.DiscountCode, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, code, description, discount_type, value, min_subtotal, max_uses, used_count, starts_at, ends_at, is_active
		 FROM discount_codes WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.DiscountCode
	for rows.Next() {
		var d models.DiscountCode
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Code, &d.Description, &d.DiscountType, &d.Value, &d.MinSubtotal, &d.MaxUses, &d.UsedCount, &d.StartsAt, &d.EndsAt, &d.IsActive); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

func (s *Store) CreateDiscountCode(ctx context.Context, d *models.DiscountCode) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO discount_codes (tenant_id, code, description, discount_type, value, min_subtotal, max_uses, starts_at, ends_at, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		d.TenantID, d.Code, d.Description, d.DiscountType, d.Value, d.MinSubtotal, d.MaxUses, d.StartsAt, d.EndsAt, d.IsActive).Scan(&d.ID)
}

func (s *Store) ValidateDiscountCode(ctx context.Context, tenantID uuid.UUID, code string, subtotal float64) (*models.DiscountCode, error) {
	d := &models.DiscountCode{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, code, description, discount_type, value, min_subtotal, max_uses, used_count, starts_at, ends_at, is_active
		 FROM discount_codes
		 WHERE tenant_id=$1 AND code=$2 AND is_active=TRUE
		   AND (starts_at IS NULL OR starts_at <= NOW())
		   AND (ends_at IS NULL OR ends_at >= NOW())
		   AND (max_uses IS NULL OR used_count < max_uses)
		   AND min_subtotal <= $3`, tenantID, code, subtotal).
		Scan(&d.ID, &d.TenantID, &d.Code, &d.Description, &d.DiscountType, &d.Value, &d.MinSubtotal, &d.MaxUses, &d.UsedCount, &d.StartsAt, &d.EndsAt, &d.IsActive)
	if err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Store) GetDiscountCodeByID(ctx context.Context, tenantID, id uuid.UUID) (*models.DiscountCode, error) {
	d := &models.DiscountCode{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, code, description, discount_type, value, min_subtotal, max_uses, used_count, starts_at, ends_at, is_active
		 FROM discount_codes WHERE id=$1 AND tenant_id=$2`, id, tenantID).
		Scan(&d.ID, &d.TenantID, &d.Code, &d.Description, &d.DiscountType, &d.Value, &d.MinSubtotal, &d.MaxUses, &d.UsedCount, &d.StartsAt, &d.EndsAt, &d.IsActive)
	if err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Store) UpdateDiscountCode(ctx context.Context, tenantID, id uuid.UUID, code, description, discountType string, value, minSubtotal float64, maxUses *int, startsAt, endsAt *time.Time, isActive bool) error {
	tag, err := s.Pool.Exec(ctx,
		`UPDATE discount_codes SET code=$1, description=$2, discount_type=$3, value=$4, min_subtotal=$5, max_uses=$6, starts_at=$7, ends_at=$8, is_active=$9
		 WHERE id=$10 AND tenant_id=$11`,
		code, description, discountType, value, minSubtotal, maxUses, startsAt, endsAt, isActive, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) DeleteDiscountCode(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM discount_codes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DiscountStats holds summary statistics for discount codes.
type DiscountStats struct {
	TotalCodes       int     `json:"total_codes"`
	ActiveCodes      int     `json:"active_codes"`
	TotalRedemptions int     `json:"total_redemptions"`
	TotalDiscount    float64 `json:"total_discount"`
}

func (s *Store) DiscountStats(ctx context.Context, tenantID uuid.UUID) (*DiscountStats, error) {
	stats := &DiscountStats{}
	err := s.Pool.QueryRow(ctx,
		`SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE is_active=TRUE),
			COALESCE(SUM(used_count), 0),
			(SELECT COALESCE(SUM(discount_total), 0) FROM orders WHERE tenant_id=$1 AND discount_total > 0)
		 FROM discount_codes WHERE tenant_id=$1`, tenantID).
		Scan(&stats.TotalCodes, &stats.ActiveCodes, &stats.TotalRedemptions, &stats.TotalDiscount)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

// IncrementDiscountUsedCount atomically increments used_count, respecting max_uses.
// Returns true if the increment succeeded (i.e. max_uses not exceeded).
func (s *Store) IncrementDiscountUsedCount(ctx context.Context, tx pgx.Tx, discountID uuid.UUID) bool {
	tag, err := tx.Exec(ctx,
		`UPDATE discount_codes SET used_count = used_count + 1 WHERE id=$1 AND (max_uses IS NULL OR used_count < max_uses)`,
		discountID)
	if err != nil || tag.RowsAffected() == 0 {
		return false
	}
	return true
}

// ---------------- Orders (minimal) ----------------

// OrderListFilter holds optional filters for listing orders.
type OrderListFilter struct {
	Status   string // filter by status
	Search   string // search by order ID, customer name, or email
	UserID   *uuid.UUID // filter by customer user ID (for storefront order history)
	Dr       DateRangeFilter // filter by created_at date range
}

func (s *Store) ListOrders(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.Order, int, error) {
	return s.ListOrdersFiltered(ctx, tenantID, OrderListFilter{}, limit, offset)
}

func (s *Store) ListOrdersFiltered(ctx context.Context, tenantID uuid.UUID, f OrderListFilter, limit, offset int) ([]models.Order, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	conds := []string{"tenant_id=$1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if f.Status != "" {
		conds = append(conds, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, f.Status)
		argIdx++
	}
	if f.UserID != nil {
		conds = append(conds, fmt.Sprintf("user_id=$%d", argIdx))
		args = append(args, *f.UserID)
		argIdx++
	}
	if f.Search != "" {
		conds = append(conds, fmt.Sprintf("(customer_name ILIKE $%d OR customer_email ILIKE $%d OR id::text ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}
	if f.Dr.From != "" {
		conds = append(conds, fmt.Sprintf("created_at >= $%d", argIdx))
		args = append(args, f.Dr.From)
		argIdx++
	}
	if f.Dr.To != "" {
		conds = append(conds, fmt.Sprintf("created_at <= $%d", argIdx))
		args = append(args, f.Dr.To)
		argIdx++
	}
	where := strings.Join(conds, " AND ")

	var total int
	if err := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM orders WHERE %s`, where), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := s.Pool.Query(ctx,
		fmt.Sprintf(`SELECT id, tenant_id, user_id, status, subtotal, discount_total, shipping_total, tax_total,
		            grand_total, currency_code, COALESCE(tracking_number,''), COALESCE(carrier,''),
		            shipped_at, delivered_at, cancelled_at, COALESCE(cancel_reason,''),
		            COALESCE(internal_notes,''), COALESCE(payment_method,''), COALESCE(transaction_id,''),
		            COALESCE(shipping_method,''), COALESCE(customer_email,''), COALESCE(customer_name,''),
		            created_at, updated_at,
		            replaces_order_id, return_id, COALESCE(order_tag,''), return_status
		             FROM orders WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
			where, argIdx, argIdx+1),
		args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.Order{}
	for rows.Next() {
		var o models.Order
		if err := rows.Scan(&o.ID, &o.TenantID, &o.UserID, &o.Status, &o.Subtotal, &o.DiscountTotal, &o.ShippingTotal, &o.TaxTotal,
			&o.GrandTotal, &o.CurrencyCode, &o.TrackingNumber, &o.Carrier, &o.ShippedAt, &o.DeliveredAt, &o.CancelledAt,
			&o.CancelReason, &o.InternalNotes, &o.PaymentMethod, &o.TransactionID, &o.ShippingMethod,
			&o.CustomerEmail, &o.CustomerName, &o.CreatedAt, &o.UpdatedAt,
			&o.ReplacesOrderID, &o.ReturnID, &o.OrderTag, &o.ReturnStatus); err != nil {
			return nil, 0, err
		}
		out = append(out, o)
	}
	return out, total, nil
}

func (s *Store) OrderCountsByStatus(ctx context.Context, tenantID uuid.UUID) (map[string]int, error) {
	rows, err := s.Pool.Query(ctx, `SELECT status, COUNT(*) FROM orders WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]int{}
	for rows.Next() {
		var status string
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			return nil, err
		}
		out[status] = n
	}
	return out, nil
}

func (s *Store) DashboardStats(ctx context.Context, tenantID uuid.UUID, dr DateRangeFilter) (map[string]interface{}, error) {
	stats := map[string]interface{}{}
	var productCount int
	s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE tenant_id=$1`, tenantID).Scan(&productCount)
	stats["products"] = productCount

	// Orders count + revenue scoped to the date range
	var args []interface{}
	argIdx := 1
	args = append(args, tenantID)
	argIdx++
	drClause, args, argIdx := dateRangeClause("created_at", dr, args, argIdx)

	var orderCount int
	s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM orders WHERE tenant_id=$1%s`, drClause), args...).Scan(&orderCount)
	stats["orders"] = orderCount

	revenueArgs := make([]interface{}, len(args))
	copy(revenueArgs, args)
	var revenue float64
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE tenant_id=$1 AND status IN ('paid','shipped','delivered','fulfilled')%s`, drClause),
		revenueArgs...).Scan(&revenue)
	stats["revenue"] = revenue

	// orders_by_status scoped to date range
	statusRows, err := s.Pool.Query(ctx,
		fmt.Sprintf(`SELECT status, COUNT(*) FROM orders WHERE tenant_id=$1%s GROUP BY status`, drClause),
		revenueArgs...)
	if err != nil {
		return nil, err
	}
	statusCounts := map[string]int{}
	if statusRows != nil {
		defer statusRows.Close()
		for statusRows.Next() {
			var st string
			var n int
			if err := statusRows.Scan(&st, &n); err != nil {
				return nil, err
			}
			statusCounts[st] = n
		}
	}
	stats["orders_by_status"] = statusCounts

	// recent orders scoped to date range
	recentArgs := make([]interface{}, len(args))
	copy(recentArgs, args)
	recentArgs = append(recentArgs, 5)
	rows, err := s.Pool.Query(ctx,
		fmt.Sprintf(`SELECT id, status, grand_total, currency_code, created_at FROM orders WHERE tenant_id=$1%s ORDER BY created_at DESC LIMIT $%d`, drClause, argIdx),
		recentArgs...)
	if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}
	if rows != nil {
		defer rows.Close()
		var recent []map[string]interface{}
		for rows.Next() {
			var id uuid.UUID
			var status, cur string
			var total float64
			var created time.Time
			if err := rows.Scan(&id, &status, &total, &cur, &created); err != nil {
				return nil, err
			}
			recent = append(recent, map[string]interface{}{"id": id, "status": status, "total": total, "currency": cur, "created_at": created})
		}
		stats["recent_orders"] = recent
	}
	return stats, nil
}

// Ensure no superadmin exists helper for seeder
func (s *Store) CountSuperAdmins(ctx context.Context) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE role='superadmin'`).Scan(&n)
	return n, err
}

// CountTenants returns the total number of tenants (used by setup flow).
func (s *Store) CountTenants(ctx context.Context) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM tenants`).Scan(&n)
	return n, err
}

// CreateSuperAdmin creates the platform superadmin.
func (s *Store) CreateSuperAdmin(ctx context.Context, email, fullName, passwordHash string) (*models.User, error) {
	u := &models.User{Email: email, FullName: fullName, Role: models.RoleSuperAdmin, IsActive: true, PasswordHash: passwordHash}
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
		 VALUES (NULL,$1,$2,$3,'superadmin',TRUE)
		 RETURNING id, created_at, updated_at`,
		email, passwordHash, fullName).
		Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// CreateBusinessAdmin creates a tenant business admin.
func (s *Store) CreateBusinessAdmin(ctx context.Context, tenantID uuid.UUID, email, fullName, passwordHash string) (*models.User, error) {
	u := &models.User{TenantID: &tenantID, Email: email, FullName: fullName, Role: models.RoleBusinessAdmin, IsActive: true, PasswordHash: passwordHash}
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
		 VALUES ($1,$2,$3,$4,'business_admin',TRUE)
		 RETURNING id, created_at, updated_at`,
		tenantID, email, passwordHash, fullName).
		Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// CreateCustomer creates a tenant customer.
func (s *Store) CreateCustomer(ctx context.Context, tenantID uuid.UUID, email, fullName, passwordHash string) (*models.User, error) {
	u := &models.User{TenantID: &tenantID, Email: email, FullName: fullName, Role: models.RoleCustomer, IsActive: true, PasswordHash: passwordHash}
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
		 VALUES ($1,$2,$3,$4,'customer',TRUE)
		 RETURNING id, created_at, updated_at`,
		tenantID, email, passwordHash, fullName).
		Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// ---------------- Cart ----------------

// GetOrCreateCart returns the cart for a session/user, creating one if needed.
func (s *Store) GetOrCreateCart(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID, sessionID, currencyCode string) (*models.Cart, error) {
	cart := &models.Cart{TenantID: tenantID, UserID: userID, SessionID: sessionID, CurrencyCode: currencyCode}

	// Try to find existing by user_id or session_id
	var cartID uuid.UUID
	if userID != nil {
		err := s.Pool.QueryRow(ctx,
			`SELECT id FROM carts WHERE tenant_id=$1 AND user_id=$2`, tenantID, *userID).Scan(&cartID)
		if err == nil {
			cart.ID = cartID
			return s.loadCartItems(ctx, cart)
		}
		if err != pgx.ErrNoRows {
			return nil, err
		}
	} else if sessionID != "" {
		err := s.Pool.QueryRow(ctx,
			`SELECT id FROM carts WHERE tenant_id=$1 AND session_id=$2 AND user_id IS NULL`, tenantID, sessionID).Scan(&cartID)
		if err == nil {
			cart.ID = cartID
			return s.loadCartItems(ctx, cart)
		}
		if err != pgx.ErrNoRows {
			return nil, err
		}
	}

	// Create new cart
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO carts (tenant_id, user_id, session_id, currency_code)
		 VALUES ($1,$2,$3,$4) RETURNING id, updated_at`,
		tenantID, userID, sessionID, currencyCode).Scan(&cart.ID, &cart.UpdatedAt)
	if err != nil {
		return nil, err
	}
	cart.Items = []models.CartItem{}
	return cart, nil
}

func (s *Store) loadCartItems(ctx context.Context, cart *models.Cart) (*models.Cart, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT ci.id, ci.product_id, ci.variant_id, p.name, v.name,
		 COALESCE(NULLIF(p.image_url, ''),
			(SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1),
			COALESCE(v.image_url, ''),
			''),
		 ci.quantity, ci.unit_price, p.tax_class_id,
		 p.requires_shipping, p.weight, p.free_shipping
		 FROM cart_items ci
		 JOIN products p ON p.id = ci.product_id
		 LEFT JOIN variants v ON v.id = ci.variant_id
		 WHERE ci.cart_id=$1 ORDER BY ci.created_at`, cart.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []models.CartItem{}
	for rows.Next() {
		var item models.CartItem
		var variantName *string
		if err := rows.Scan(&item.ID, &item.ProductID, &item.VariantID, &item.ProductName, &variantName, &item.ImageURL, &item.Quantity, &item.UnitPrice, &item.TaxClassID,
			&item.RequiresShipping, &item.Weight, &item.FreeShipping); err != nil {
			return nil, err
		}
		if variantName != nil {
			item.VariantName = *variantName
		}
		item.LineTotal = item.UnitPrice * float64(item.Quantity)
		items = append(items, item)
	}
	cart.Items = items
	_ = s.Pool.QueryRow(ctx, `SELECT updated_at FROM carts WHERE id=$1`, cart.ID).Scan(&cart.UpdatedAt)
	return cart, nil
}

// AddToCart adds a product/variant to the cart, merging if the same item already exists.
// It validates stock availability before adding.
func (s *Store) AddToCart(ctx context.Context, cartID uuid.UUID, productID uuid.UUID, variantID *uuid.UUID, quantity int, unitPrice float64) error {
	// Check stock availability
	available, err := s.GetStockLevel(ctx, cartID, productID, variantID)
	if err != nil {
		return err
	}
	// Check existing cart quantity for this item
	var existingQty int
	existingErr := s.Pool.QueryRow(ctx,
		`SELECT quantity FROM cart_items WHERE cart_id=$1 AND product_id=$2 AND (variant_id IS NOT DISTINCT FROM $3)`,
		cartID, productID, variantID).Scan(&existingQty)
	if existingErr != nil && existingErr != pgx.ErrNoRows {
		return existingErr
	}
	if existingQty+quantity > available {
		return fmt.Errorf("insufficient stock: requested %d, have %d, already in cart %d", quantity, available, existingQty)
	}

	var itemID uuid.UUID
	err = s.Pool.QueryRow(ctx,
		`SELECT id FROM cart_items WHERE cart_id=$1 AND product_id=$2 AND (variant_id IS NOT DISTINCT FROM $3)`,
		cartID, productID, variantID).Scan(&itemID)
	if err == nil {
		_, err := s.Pool.Exec(ctx,
			`UPDATE cart_items SET quantity = quantity + $1 WHERE id=$2`, quantity, itemID)
		return err
	}
	if err != pgx.ErrNoRows {
		return err
	}
	_, err = s.Pool.Exec(ctx,
		`INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit_price)
		 VALUES ($1,$2,$3,$4,$5)`, cartID, productID, variantID, quantity, unitPrice)
	return err
}

// UpdateCartItem changes the quantity of a cart item.
// It validates stock availability before updating.
func (s *Store) UpdateCartItem(ctx context.Context, cartID, itemID uuid.UUID, quantity int) error {
	if quantity <= 0 {
		return s.RemoveCartItem(ctx, cartID, itemID)
	}
	// Get the product/variant for this cart item to check stock
	var productID uuid.UUID
	var variantID *uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`SELECT product_id, variant_id FROM cart_items WHERE id=$1 AND cart_id=$2`, itemID, cartID).
		Scan(&productID, &variantID)
	if err != nil {
		return sql.ErrNoRows
	}
	available, err := s.GetStockLevel(ctx, cartID, productID, variantID)
	if err != nil {
		return err
	}
	if quantity > available {
		return fmt.Errorf("insufficient stock: requested %d, available %d", quantity, available)
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE cart_items SET quantity=$1 WHERE id=$2 AND cart_id=$3`, quantity, itemID, cartID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetStockLevel returns the available stock for a product or variant.
// For products with variants, returns the variant stock if variantID is provided.
// If inventory tracking is disabled, returns a large number (effectively unlimited).
func (s *Store) GetStockLevel(ctx context.Context, cartID uuid.UUID, productID uuid.UUID, variantID *uuid.UUID) (int, error) {
	if variantID != nil {
		var stock int
		err := s.Pool.QueryRow(ctx, `SELECT stock FROM variants WHERE id=$1`, *variantID).Scan(&stock)
		if err != nil {
			return 0, err
		}
		return stock, nil
	}
	var stock int
	var trackInventory bool
	err := s.Pool.QueryRow(ctx, `SELECT stock, track_inventory FROM products WHERE id=$1`, productID).Scan(&stock, &trackInventory)
	if err != nil {
		return 0, err
	}
	if !trackInventory {
		return 999999, nil
	}
	return stock, nil
}

// RemoveCartItem deletes an item from the cart.
func (s *Store) RemoveCartItem(ctx context.Context, cartID, itemID uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM cart_items WHERE id=$1 AND cart_id=$2`, itemID, cartID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ClearCart removes all items from the cart.
func (s *Store) ClearCart(ctx context.Context, cartID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cartID)
	return err
}

// CartSubtotal computes the subtotal of all items.
func CartSubtotal(cart *models.Cart) float64 {
	var total float64
	for _, item := range cart.Items {
		total += item.LineTotal
	}
	return total
}

// ---------------- Wishlist ----------------

func (s *Store) GetOrCreateWishlist(ctx context.Context, tenantID uuid.UUID, userID *uuid.UUID, sessionID string) (*models.Wishlist, error) {
	wl := &models.Wishlist{TenantID: tenantID, UserID: userID, SessionID: sessionID}

	var wlID uuid.UUID
	if userID != nil {
		err := s.Pool.QueryRow(ctx,
			`SELECT id FROM wishlists WHERE tenant_id=$1 AND user_id=$2`, tenantID, *userID).Scan(&wlID)
		if err == nil {
			wl.ID = wlID
			return s.loadWishlistItems(ctx, wl)
		}
		if err != pgx.ErrNoRows {
			return nil, err
		}
	} else if sessionID != "" {
		err := s.Pool.QueryRow(ctx,
			`SELECT id FROM wishlists WHERE tenant_id=$1 AND session_id=$2 AND user_id IS NULL`, tenantID, sessionID).Scan(&wlID)
		if err == nil {
			wl.ID = wlID
			return s.loadWishlistItems(ctx, wl)
		}
		if err != pgx.ErrNoRows {
			return nil, err
		}
	}

	err := s.Pool.QueryRow(ctx,
		`INSERT INTO wishlists (tenant_id, user_id, session_id) VALUES ($1,$2,$3) RETURNING id`,
		tenantID, userID, sessionID).Scan(&wl.ID)
	if err != nil {
		return nil, err
	}
	wl.Items = []models.WishlistItem{}
	return wl, nil
}

func (s *Store) loadWishlistItems(ctx context.Context, wl *models.Wishlist) (*models.Wishlist, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT wi.id, wi.product_id, wi.variant_id, p.name,
		 COALESCE(NULLIF(p.image_url, ''),
			(SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT image_url FROM variants WHERE product_id = p.id AND image_url IS NOT NULL AND image_url != '' ORDER BY created_at ASC LIMIT 1),
			''), p.slug,
		 COALESCE(NULLIF(p.base_price, 0),
			(SELECT price FROM variants WHERE product_id = p.id AND price IS NOT NULL AND price > 0 ORDER BY created_at ASC LIMIT 1),
			0), wi.created_at
		 FROM wishlist_items wi
		 JOIN products p ON p.id = wi.product_id
		 WHERE wi.wishlist_id=$1 ORDER BY wi.created_at DESC`, wl.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []models.WishlistItem{}
	for rows.Next() {
		var item models.WishlistItem
		if err := rows.Scan(&item.ID, &item.ProductID, &item.VariantID, &item.ProductName, &item.ImageURL, &item.Slug, &item.BasePrice, &item.AddedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	wl.Items = items
	return wl, nil
}

func (s *Store) AddToWishlist(ctx context.Context, wishlistID, productID uuid.UUID, variantID *uuid.UUID) error {
	_, err := s.Pool.Exec(ctx,
		`INSERT INTO wishlist_items (wishlist_id, product_id, variant_id) VALUES ($1,$2,$3)
		 ON CONFLICT (wishlist_id, product_id, variant_id) DO NOTHING`,
		wishlistID, productID, variantID)
	return err
}

func (s *Store) RemoveFromWishlist(ctx context.Context, wishlistID, itemID uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM wishlist_items WHERE id=$1 AND wishlist_id=$2`, itemID, wishlistID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) RemoveProductFromWishlist(ctx context.Context, wishlistID, productID uuid.UUID, variantID *uuid.UUID) error {
	_, err := s.Pool.Exec(ctx,
		`DELETE FROM wishlist_items WHERE wishlist_id=$1 AND product_id=$2 AND (variant_id IS NOT DISTINCT FROM $3)`,
		wishlistID, productID, variantID)
	return err
}

func (s *Store) IsInWishlist(ctx context.Context, wishlistID, productID uuid.UUID, variantID *uuid.UUID) (bool, error) {
	var exists bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM wishlist_items WHERE wishlist_id=$1 AND product_id=$2 AND (variant_id IS NOT DISTINCT FROM $3))`,
		wishlistID, productID, variantID).Scan(&exists)
	return exists, err
}

func (s *Store) ClearWishlist(ctx context.Context, wishlistID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM wishlist_items WHERE wishlist_id=$1`, wishlistID)
	return err
}

// ---------------- Reviews ----------------

func (s *Store) ListReviews(ctx context.Context, tenantID, productID uuid.UUID) ([]models.Review, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, product_id, user_id, author_name, rating, title, body, is_verified, is_approved, created_at
		 FROM product_reviews
		 WHERE tenant_id=$1 AND product_id=$2 AND is_approved=TRUE
		 ORDER BY created_at DESC`, tenantID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Review
	for rows.Next() {
		var r models.Review
		if err := rows.Scan(&r.ID, &r.TenantID, &r.ProductID, &r.UserID, &r.AuthorName, &r.Rating, &r.Title, &r.Body, &r.IsVerified, &r.IsApproved, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if err := s.attachReviewImages(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

// attachReviewImages loads images for all reviews in a single query.
func (s *Store) attachReviewImages(ctx context.Context, reviews []models.Review) error {
	if len(reviews) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, len(reviews))
	idx := make(map[uuid.UUID]int, len(reviews))
	for i := range reviews {
		ids[i] = reviews[i].ID
		idx[reviews[i].ID] = i
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT review_id, id, url, alt, sort_order FROM review_images
		 WHERE review_id = ANY($1) ORDER BY review_id, sort_order`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var img models.ReviewImage
		if err := rows.Scan(&img.ReviewID, &img.ID, &img.URL, &img.Alt, &img.SortOrder); err != nil {
			return err
		}
		i := idx[img.ReviewID]
		reviews[i].Images = append(reviews[i].Images, img)
	}
	return nil
}

func (s *Store) GetReviewSummary(ctx context.Context, tenantID, productID uuid.UUID) (*models.ReviewSummary, error) {
	var avgRating float64
	var total int
	dist := map[int]int{1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

	rows, err := s.Pool.Query(ctx,
		`SELECT rating, COUNT(*) FROM product_reviews
		 WHERE tenant_id=$1 AND product_id=$2 AND is_approved=TRUE
		 GROUP BY rating`, tenantID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var star, count int
		if err := rows.Scan(&star, &count); err != nil {
			return nil, err
		}
		dist[star] = count
		total += count
	}

	if total > 0 {
		var sum float64
		for star, count := range dist {
			sum += float64(star * count)
		}
		avgRating = sum / float64(total)
	}

	return &models.ReviewSummary{
		Rating:        avgRating,
		TotalReviews:  total,
		Distribution:  dist,
	}, nil
}

// CreateReview inserts a review and its images in a transaction.
func (s *Store) CreateReview(ctx context.Context, r *models.Review, images []models.ReviewImage) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := tx.QueryRow(ctx,
		`INSERT INTO product_reviews (tenant_id, product_id, user_id, author_name, rating, title, body, is_verified)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
		r.TenantID, r.ProductID, r.UserID, r.AuthorName, r.Rating, r.Title, r.Body, r.IsVerified,
	).Scan(&r.ID, &r.CreatedAt); err != nil {
		return err
	}

	for i := range images {
		img := images[i]
		if err := tx.QueryRow(ctx,
			`INSERT INTO review_images (review_id, url, alt, sort_order)
			 VALUES ($1,$2,$3,$4) RETURNING id`,
			r.ID, img.URL, img.Alt, img.SortOrder,
		).Scan(&images[i].ID); err != nil {
			return err
		}
		images[i].ReviewID = r.ID
	}
	r.Images = images

	return tx.Commit(ctx)
}

// HasPurchasedProduct returns true if the user has a non-cancelled/failed order
// containing the given product.
func (s *Store) HasPurchasedProduct(ctx context.Context, tenantID, userID, productID uuid.UUID) (bool, error) {
	var exists bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM order_items oi
			JOIN orders o ON o.id = oi.order_id
			WHERE o.tenant_id=$1 AND o.user_id=$2 AND oi.product_id=$3
			  AND o.status NOT IN ('cancelled','failed')
		)`, tenantID, userID, productID).Scan(&exists)
	return exists, err
}

// ListPurchasedProducts returns distinct products the customer has purchased,
// with the most recent order info, whether they've already reviewed, and return
// eligibility computed from the order's delivered_at + product/tenant period settings.
func (s *Store) ListPurchasedProducts(ctx context.Context, tenantID, userID uuid.UUID) ([]models.PurchasedProduct, error) {
	// Load tenant-level return period settings (used as fallback for products without overrides)
	tenantReturn := 30
	tenantRefund := 30
	tenantReplacement := 15
	if ts, err := s.GetTenantSettings(ctx, tenantID); err == nil {
		if ts.ReturnPeriodDays > 0 {
			tenantReturn = ts.ReturnPeriodDays
		}
		if ts.RefundPeriodDays > 0 {
			tenantRefund = ts.RefundPeriodDays
		}
		if ts.ReplacementPeriodDays > 0 {
			tenantReplacement = ts.ReplacementPeriodDays
		}
	}

	rows, err := s.Pool.Query(ctx,
		`SELECT DISTINCT ON (p.id)
		    p.id, p.slug, p.name, p.image_url,
		    o.id, o.created_at, o.status, o.delivered_at,
		    p.return_period_days, p.refund_period_days, p.replacement_period_days,
		    p.return_enabled, p.refund_enabled, p.replacement_enabled,
		    EXISTS(SELECT 1 FROM product_reviews pr WHERE pr.tenant_id=$1 AND pr.user_id=$2 AND pr.product_id=p.id) AS has_reviewed
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 JOIN products p ON p.id = oi.product_id
		 WHERE o.tenant_id=$1 AND o.user_id=$2 AND o.status NOT IN ('cancelled','failed')
		 ORDER BY p.id, o.created_at DESC`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.PurchasedProduct
	now := time.Now()
	for rows.Next() {
		var pp models.PurchasedProduct
		var pReturn, pRefund, pReplacement *int
		var pReturnEn, pRefundEn, pReplacementEn *bool
		if err := rows.Scan(&pp.ProductID, &pp.Slug, &pp.Name, &pp.ImageURL, &pp.OrderID, &pp.OrderDate, &pp.OrderStatus, &pp.DeliveredAt, &pReturn, &pRefund, &pReplacement, &pReturnEn, &pRefundEn, &pReplacementEn, &pp.HasReviewed); err != nil {
			return nil, err
		}
		// Resolve effective periods: product override → tenant default
		retPeriod := tenantReturn
		refPeriod := tenantRefund
		repPeriod := tenantReplacement
		if pReturn != nil && *pReturn > 0 {
			retPeriod = *pReturn
		}
		if pRefund != nil && *pRefund > 0 {
			refPeriod = *pRefund
		}
		if pReplacement != nil && *pReplacement > 0 {
			repPeriod = *pReplacement
		}
		// Resolve allowed flags: product override → default true
		pp.ReturnAllowed = pReturnEn == nil || *pReturnEn
		pp.RefundAllowed = pRefundEn == nil || *pRefundEn
		pp.ReplacementAllowed = pReplacementEn == nil || *pReplacementEn
		// Compute return eligibility from delivered_at
		if pp.DeliveredAt != nil {
			delivered := *pp.DeliveredAt
			retExp := delivered.AddDate(0, 0, retPeriod)
			refExp := delivered.AddDate(0, 0, refPeriod)
			repExp := delivered.AddDate(0, 0, repPeriod)
			pp.ReturnExpiresAt = &retExp
			pp.RefundExpiresAt = &refExp
			pp.ReplacementExpiresAt = &repExp
			pp.ReturnEligible = pp.ReturnAllowed && now.Before(retExp)
			pp.RefundEligible = pp.RefundAllowed && now.Before(refExp)
			pp.ReplacementEligible = pp.ReplacementAllowed && now.Before(repExp)
		}
		out = append(out, pp)
	}
	return out, nil
}

// GetUserReview returns the customer's review for a product, or nil if none.
func (s *Store) GetUserReview(ctx context.Context, tenantID, userID, productID uuid.UUID) (*models.Review, error) {
	var r models.Review
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, product_id, user_id, author_name, rating, title, body, is_verified, is_approved, created_at
		 FROM product_reviews
		 WHERE tenant_id=$1 AND user_id=$2 AND product_id=$3`,
		tenantID, userID, productID,
	).Scan(&r.ID, &r.TenantID, &r.ProductID, &r.UserID, &r.AuthorName, &r.Rating, &r.Title, &r.Body, &r.IsVerified, &r.IsApproved, &r.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	imgs, err := s.listReviewImages(ctx, r.ID)
	if err != nil {
		return nil, err
	}
	r.Images = imgs
	return &r, nil
}

func (s *Store) listReviewImages(ctx context.Context, reviewID uuid.UUID) ([]models.ReviewImage, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, review_id, url, alt, sort_order FROM review_images
		 WHERE review_id=$1 ORDER BY sort_order`, reviewID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ReviewImage
	for rows.Next() {
		var img models.ReviewImage
		if err := rows.Scan(&img.ID, &img.ReviewID, &img.URL, &img.Alt, &img.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	return out, nil
}

// ListUserReviews returns all reviews written by the given user.
func (s *Store) ListUserReviews(ctx context.Context, tenantID, userID uuid.UUID) ([]models.Review, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, product_id, user_id, author_name, rating, title, body, is_verified, is_approved, created_at
		 FROM product_reviews
		 WHERE tenant_id=$1 AND user_id=$2
		 ORDER BY created_at DESC`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Review
	for rows.Next() {
		var r models.Review
		if err := rows.Scan(&r.ID, &r.TenantID, &r.ProductID, &r.UserID, &r.AuthorName, &r.Rating, &r.Title, &r.Body, &r.IsVerified, &r.IsApproved, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if err := s.attachReviewImages(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ============================================================
// Addresses
// ============================================================

func (s *Store) ListAddresses(ctx context.Context, tenantID, userID uuid.UUID) ([]models.Address, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, user_id, tenant_id, label, first_name, last_name, email, line1, line2, city, state, postal_code, country, phone, is_default, created_at
		 FROM addresses WHERE tenant_id=$1 AND user_id=$2 ORDER BY is_default DESC, created_at DESC`,
		tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Address
	for rows.Next() {
		var a models.Address
		if err := rows.Scan(&a.ID, &a.UserID, &a.TenantID, &a.Label, &a.FirstName, &a.LastName, &a.Email, &a.Line1, &a.Line2, &a.City, &a.State, &a.PostalCode, &a.Country, &a.Phone, &a.IsDefault, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, nil
}

func (s *Store) SaveAddress(ctx context.Context, a *models.Address) error {
	if a.ID == uuid.Nil {
		return s.Pool.QueryRow(ctx,
			`INSERT INTO addresses (user_id, tenant_id, label, first_name, last_name, email, line1, line2, city, state, postal_code, country, phone, is_default)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, created_at`,
			a.UserID, a.TenantID, a.Label, a.FirstName, a.LastName, a.Email, a.Line1, a.Line2, a.City, a.State, a.PostalCode, a.Country, a.Phone, a.IsDefault,
		).Scan(&a.ID, &a.CreatedAt)
	}
	_, err := s.Pool.Exec(ctx,
		`UPDATE addresses SET label=$3, first_name=$4, last_name=$5, email=$6, line1=$7, line2=$8, city=$9, state=$10, postal_code=$11, country=$12, phone=$13, is_default=$14
		 WHERE id=$1 AND tenant_id=$2`,
		a.ID, a.TenantID, a.Label, a.FirstName, a.LastName, a.Email, a.Line1, a.Line2, a.City, a.State, a.PostalCode, a.Country, a.Phone, a.IsDefault)
	return err
}

func (s *Store) DeleteAddress(ctx context.Context, tenantID, userID, addrID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx,
		`DELETE FROM addresses WHERE id=$1 AND tenant_id=$2 AND user_id=$3`,
		addrID, tenantID, userID)
	return err
}

// FindMatchingAddress returns the address ID if an identical address already exists
// for this user/tenant (matching all address fields). Used to avoid duplicates when
// auto-saving addresses from checkout.
func (s *Store) FindMatchingAddress(ctx context.Context, tenantID, userID uuid.UUID, a *models.Address) (uuid.UUID, error) {
	var id uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`SELECT id FROM addresses
		 WHERE tenant_id=$1 AND user_id=$2
		   AND COALESCE(line1,'')=COALESCE($3,'')
		   AND COALESCE(line2,'')=COALESCE($4,'')
		   AND COALESCE(city,'')=COALESCE($5,'')
		   AND COALESCE(state,'')=COALESCE($6,'')
		   AND COALESCE(postal_code,'')=COALESCE($7,'')
		   AND COALESCE(country,'')=COALESCE($8,'')
		   AND COALESCE(phone,'')=COALESCE($9,'')
		   AND COALESCE(first_name,'')=COALESCE($10,'')
		   AND COALESCE(last_name,'')=COALESCE($11,'')
		   AND COALESCE(email,'')=COALESCE($12,'')
		 LIMIT 1`,
		tenantID, userID, a.Line1, a.Line2, a.City, a.State, a.PostalCode, a.Country, a.Phone, a.FirstName, a.LastName, a.Email,
	).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// ============================================================
// Checkout / Orders
// ============================================================

// LinkOrdersToUser assigns guest orders (created with the given session ID and no user)
// to the newly registered customer. This is used when a guest customer registers after
// completing a purchase so their order history is preserved.
func (s *Store) LinkOrdersToUser(ctx context.Context, tenantID, userID uuid.UUID, sessionID string) (int64, error) {
	if sessionID == "" {
		return 0, nil
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE orders SET user_id=$1 WHERE tenant_id=$2 AND session_id=$3 AND user_id IS NULL`,
		userID, tenantID, sessionID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// LinkOrdersToUserByEmail assigns guest orders (user_id IS NULL) placed with the given
// customer email to the newly registered customer, so that anonymous purchases made
// with the same email are visible in the customer's order history after signup.
// The match is case-insensitive and trims surrounding whitespace. Returns the number
// of orders linked.
func (s *Store) LinkOrdersToUserByEmail(ctx context.Context, tenantID, userID uuid.UUID, email string) (int64, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return 0, nil
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE orders SET user_id=$1
		 WHERE tenant_id=$2 AND user_id IS NULL
		   AND lower(trim(customer_email)) = $3`,
		userID, tenantID, email)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// CreateOrderFromCart creates an order from the given cart, with shipping/billing addresses and totals.
func (s *Store) CreateOrderFromCart(ctx context.Context, cart *models.Cart, req *models.CheckoutRequest, userID *uuid.UUID) (*models.Order, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	subtotal := CartSubtotal(cart)

	// Calculate shipping using the shipping module (replaces hardcoded rates)
	shippingTotal := 0.0
	shippingWeight := 0.0
	// Build shipping calculation items from cart and compute total weight
	shipItems := make([]models.ShippingCalculationItem, 0, len(cart.Items))
	for _, ci := range cart.Items {
		shipItems = append(shipItems, models.ShippingCalculationItem{
			ProductID:        ci.ProductID,
			Quantity:         ci.Quantity,
			LineTotal:        ci.LineTotal,
			RequiresShipping: ci.RequiresShipping,
			Weight:           ci.Weight,
			FreeShipping:     ci.FreeShipping,
		})
		if ci.RequiresShipping {
			shippingWeight += ci.Weight * float64(ci.Quantity)
		}
	}
	// Per-item shipping methods (split-shipment support). When the customer
	// selected a shipping method per cart item, we compute the cost per item
	// and sum them. Otherwise we fall back to the order-level shipping method.
	// perItemShipping maps cart item index → {method, cost, weight}
	perItemShipping := make(map[int]struct {
		method string
		cost   float64
		weight float64
	})
	hasItemShippingMethods := len(req.ItemShippingMethods) > 0
	if hasItemShippingMethods {
		// Build a lookup of cart item index → method code
		itemMethod := make(map[int]string)
		for _, ism := range req.ItemShippingMethods {
			itemMethod[ism.CartItemIndex] = ism.MethodCode
		}
		for i, ci := range cart.Items {
			itemWeight := 0.0
			if ci.RequiresShipping {
				itemWeight = ci.Weight * float64(ci.Quantity)
			}
			methodCode := itemMethod[i]
			cost := 0.0
			if methodCode != "" && ci.RequiresShipping {
				c, cErr := s.ResolveShippingRateForItem(ctx, cart.TenantID, methodCode, shipItems[i])
				if cErr == nil {
					cost = c
				}
			}
			perItemShipping[i] = struct {
				method string
				cost   float64
				weight float64
			}{method: methodCode, cost: cost, weight: itemWeight}
			shippingTotal += cost
		}
	} else if req.ShippingMethod != "" {
		st, sErr := s.ResolveShippingRate(ctx, cart.TenantID, req.ShippingMethod, subtotal, req.ShippingAddress, shipItems)
		if sErr == nil {
			shippingTotal = st
		} else {
			// Fall back to legacy hardcoded rates if method not found
			if req.ShippingMethod == "express" {
				shippingTotal = 15.00
			} else if subtotal >= 50 {
				shippingTotal = 0
			} else {
				shippingTotal = 5.99
			}
		}
	}

	// Calculate discount
	discountTotal := 0.0
	if req.DiscountCode != "" {
		dc, err := s.ValidateDiscountCode(ctx, cart.TenantID, req.DiscountCode, subtotal)
		if err == nil && dc != nil {
			if dc.DiscountType == "percentage" {
				discountTotal = subtotal * dc.Value / 100
			} else {
				discountTotal = dc.Value
			}
			if discountTotal > subtotal {
				discountTotal = subtotal
			}
			// Increment used count atomically (respects max_uses)
			s.IncrementDiscountUsedCount(ctx, tx, dc.ID)
		}
	}

	// Calculate tax using the tax module (replaces hardcoded 8%)
	taxTotal := 0.0
	var taxBreakdown []models.TaxBreakdownLine
	// perItemTax maps cart item index → tax amount for that item
	perItemTax := make(map[int]float64)
	settings, sErr := s.GetTenantSettings(ctx, cart.TenantID)
	if sErr == nil && settings != nil {
		taxItems := make([]models.TaxCalculationItem, 0, len(cart.Items))
		for _, ci := range cart.Items {
			taxItems = append(taxItems, models.TaxCalculationItem{
				ProductID:   ci.ProductID,
				ProductName: ci.ProductName,
				Quantity:    ci.Quantity,
				UnitPrice:   ci.UnitPrice,
				LineTotal:   ci.LineTotal,
				TaxClassID:  ci.TaxClassID,
			})
		}
		taxReq := &models.TaxCalculationRequest{
			Items:           taxItems,
			ShippingAddress: req.ShippingAddress,
			ShippingTotal:   shippingTotal,
			DiscountTotal:   discountTotal,
		}
		taxResult, tErr := s.CalculateTax(ctx, cart.TenantID, taxReq, settings)
		if tErr == nil && taxResult != nil {
			taxTotal = taxResult.TaxTotal
			taxBreakdown = taxResult.Breakdown
		}
		// Compute per-item tax by re-running the grouping logic to allocate
		// the total tax proportionally across items. This gives each order
		// item a tax_amount that sums to taxTotal.
		if taxTotal > 0 && len(cart.Items) > 0 {
			// Allocate tax proportionally by line total
			lineTotalSum := 0.0
			for _, ci := range cart.Items {
				lineTotalSum += ci.LineTotal
			}
			if lineTotalSum > 0 {
				allocated := 0.0
				for i, ci := range cart.Items {
					if i == len(cart.Items)-1 {
						// last item gets the remainder to avoid rounding drift
						perItemTax[i] = taxTotal - allocated
					} else {
						share := taxTotal * ci.LineTotal / lineTotalSum
						perItemTax[i] = share
						allocated += share
					}
				}
			} else {
				// equal split if no line totals
				each := taxTotal / float64(len(cart.Items))
				for i := range cart.Items {
					perItemTax[i] = each
				}
			}
		}
	}
	if taxTotal < 0 {
		taxTotal = 0
	}

	grandTotal := subtotal - discountTotal + shippingTotal + taxTotal
	if grandTotal < 0 {
		grandTotal = 0
	}

	currencyCode := req.CurrencyCode
	if currencyCode == "" {
		currencyCode = cart.CurrencyCode
	}

	// Marshal addresses to JSONB
	shippingAddr, _ := pgxJSONMarshal(req.ShippingAddress)
	billingAddr := shippingAddr
	if req.BillingAddress != nil {
		billingAddr, _ = pgxJSONMarshal(*req.BillingAddress)
	}

	// Determine order status from the gateway result (set by checkout handler).
	// Falls back to "pending" for safety.
	status := req.PaymentStatus
	if status == "" {
		status = "pending"
	}

	var order models.Order
	// Build initial status history
	initialHistory := []models.OrderStatusEvent{
		{Status: status, Timestamp: time.Now(), Actor: "system", Note: "Order created"},
	}
	historyJSON, _ := json.Marshal(initialHistory)

	customerName := req.ShippingAddress.FirstName + " " + req.ShippingAddress.LastName
	customerEmail := req.ShippingAddress.Email

	// Marshal tax breakdown to JSONB
	taxBreakdownJSON, _ := json.Marshal(taxBreakdown)
	if taxBreakdownJSON == nil {
		taxBreakdownJSON = []byte("[]")
	}

	err = tx.QueryRow(ctx,
		`INSERT INTO orders (tenant_id, user_id, status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency_code,
		      shipping_address, billing_address, payment_method, transaction_id, shipping_method, shipping_weight, customer_name, customer_email, status_history, session_id, tax_breakdown)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		 RETURNING id, tenant_id, user_id, status, subtotal, discount_total, shipping_total, tax_total, grand_total, currency_code, created_at`,
		cart.TenantID, userID, status, subtotal, discountTotal, shippingTotal, taxTotal, grandTotal, currencyCode,
		shippingAddr, billingAddr, req.PaymentMethod, req.TransactionID, req.ShippingMethod, shippingWeight, customerName, customerEmail, historyJSON, cart.SessionID, taxBreakdownJSON,
	).Scan(&order.ID, &order.TenantID, &order.UserID, &order.Status, &order.Subtotal, &order.DiscountTotal, &order.ShippingTotal, &order.TaxTotal, &order.GrandTotal, &order.CurrencyCode, &order.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Insert order items from cart items and decrement stock
	for i, item := range cart.Items {
		itemTax := perItemTax[i]
		itemTaxRate := 0.0
		if item.LineTotal > 0 && itemTax > 0 {
			itemTaxRate = (itemTax / item.LineTotal) * 100
		}
		// Per-item shipping (split-shipment support). Falls back to the
		// order-level shipping method/cost when no per-item selection was made.
		itemShipMethod := ""
		itemShipCost := 0.0
		itemShipWeight := 0.0
		if hasItemShippingMethods {
			ps := perItemShipping[i]
			itemShipMethod = ps.method
			itemShipCost = ps.cost
			itemShipWeight = ps.weight
		} else if item.RequiresShipping {
			itemShipMethod = req.ShippingMethod
			itemShipCost = 0 // order-level cost is on the order, not allocated per item
			itemShipWeight = item.Weight * float64(item.Quantity)
		}
		_, err := tx.Exec(ctx,
			`INSERT INTO order_items (order_id, product_id, variant_id, name, sku, quantity, unit_price, line_total, tax_amount, tax_rate, tax_class_id, shipping_method, shipping_cost, shipping_weight)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
			order.ID, item.ProductID, item.VariantID, item.ProductName, "", item.Quantity, item.UnitPrice, item.LineTotal,
			itemTax, itemTaxRate, item.TaxClassID, itemShipMethod, itemShipCost, itemShipWeight,
		)
		if err != nil {
			return nil, err
		}
		// Decrement stock atomically
		if item.VariantID != nil {
			tag, sErr := tx.Exec(ctx,
				`UPDATE variants SET stock = stock - $1 WHERE id=$2 AND stock >= $1`,
				item.Quantity, *item.VariantID)
			if sErr != nil {
				return nil, sErr
			}
			if tag.RowsAffected() == 0 {
				return nil, fmt.Errorf("insufficient stock for variant %s", item.VariantID)
			}
		} else {
			tag, sErr := tx.Exec(ctx,
				`UPDATE products SET stock = stock - $1 WHERE id=$2 AND stock >= $1`,
				item.Quantity, item.ProductID)
			if sErr != nil {
				return nil, sErr
			}
			if tag.RowsAffected() == 0 {
				return nil, fmt.Errorf("insufficient stock for product %s", item.ProductName)
			}
		}
		// Record stock movement
		_, _ = tx.Exec(ctx,
			`INSERT INTO stock_movements (tenant_id, product_id, variant_id, movement_type, quantity, reference)
			 VALUES ($1,$2,$3,'order',$4,$5)`,
			cart.TenantID, item.ProductID, item.VariantID, -item.Quantity, order.ID.String())
	}

	// Clear the cart
	_, _ = tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id=$1`, cart.ID)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	// Build order items for response from cart items
	for i, item := range cart.Items {
		oi := models.OrderItem{
			ProductID:  item.ProductID,
			VariantID:  item.VariantID,
			Name:       item.ProductName,
			Quantity:   item.Quantity,
			UnitPrice:  item.UnitPrice,
			LineTotal:  item.LineTotal,
			TaxAmount:  perItemTax[i],
			TaxClassID: item.TaxClassID,
		}
		if hasItemShippingMethods {
			ps := perItemShipping[i]
			oi.ShippingMethod = ps.method
			oi.ShippingCost = ps.cost
			oi.ShippingWeight = ps.weight
		} else if item.RequiresShipping {
			oi.ShippingMethod = req.ShippingMethod
			oi.ShippingWeight = item.Weight * float64(item.Quantity)
		}
		order.Items = append(order.Items, oi)
	}
	order.TaxBreakdown = taxBreakdown
	order.ShippingWeight = shippingWeight
	order.ShippingTotal = shippingTotal
	order.ShippingMethod = req.ShippingMethod

	// Auto-deliver: if the order is paid and no items require shipping,
	// skip 'processing'/'shipped' and go directly to 'delivered'.
	if order.Status == "paid" {
		var allNoShipping bool
		_ = s.Pool.QueryRow(ctx,
			`SELECT COALESCE(BOOL_AND(p.requires_shipping = false), false)
			 FROM order_items oi JOIN products p ON p.id = oi.product_id
			 WHERE oi.order_id=$1`, order.ID).Scan(&allNoShipping)
		if allNoShipping {
			now := time.Now()
			deliverEvent := models.OrderStatusEvent{
				Status:    "delivered",
				Timestamp: now,
				Actor:     "system",
				Note:      "Auto-delivered (no shipping required)",
			}
			deliverEventJSON, _ := json.Marshal([]models.OrderStatusEvent{deliverEvent})
			_, _ = s.Pool.Exec(ctx,
				`UPDATE orders SET status='delivered', delivered_at=$3, status_history = status_history || $4::jsonb, updated_at=NOW()
				 WHERE id=$1 AND tenant_id=$2`,
				order.ID, cart.TenantID, now, deliverEventJSON)
			order.Status = "delivered"
			order.DeliveredAt = &now
		}
	}

	return &order, nil
}

// GetOrderByID returns a single order with its items and workflow fields.
func (s *Store) GetOrderByID(ctx context.Context, tenantID, orderID uuid.UUID) (*models.Order, error) {
	var o models.Order
	var historyJSON, taxBreakdownJSON []byte
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, user_id, status, subtotal, discount_total, shipping_total, tax_total,
		        grand_total, currency_code, COALESCE(tracking_number,''), COALESCE(carrier,''),
		        shipped_at, delivered_at, cancelled_at, COALESCE(cancel_reason,''),
		        COALESCE(internal_notes,''), COALESCE(payment_method,''), COALESCE(transaction_id,''),
		        COALESCE(shipping_method,''), shipping_weight, COALESCE(customer_email,''), COALESCE(customer_name,''),
		        status_history, created_at, updated_at,
		        replaces_order_id, return_id, COALESCE(order_tag,''), tax_breakdown, return_status
		 FROM orders WHERE id=$1 AND tenant_id=$2`,
		orderID, tenantID,
	).Scan(&o.ID, &o.TenantID, &o.UserID, &o.Status, &o.Subtotal, &o.DiscountTotal, &o.ShippingTotal, &o.TaxTotal,
		&o.GrandTotal, &o.CurrencyCode, &o.TrackingNumber, &o.Carrier, &o.ShippedAt, &o.DeliveredAt,
		&o.CancelledAt, &o.CancelReason, &o.InternalNotes, &o.PaymentMethod, &o.TransactionID,
		&o.ShippingMethod, &o.ShippingWeight, &o.CustomerEmail, &o.CustomerName, &historyJSON, &o.CreatedAt, &o.UpdatedAt,
		&o.ReplacesOrderID, &o.ReturnID, &o.OrderTag, &taxBreakdownJSON, &o.ReturnStatus)
	if err != nil {
		return nil, err
	}
	if len(historyJSON) > 0 {
		_ = json.Unmarshal(historyJSON, &o.StatusHistory)
	}
	if len(taxBreakdownJSON) > 0 {
		_ = json.Unmarshal(taxBreakdownJSON, &o.TaxBreakdown)
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT id, product_id, variant_id, name, sku, quantity, unit_price, line_total, tax_amount, tax_rate, tax_class_id,
		        shipping_method, shipping_cost, shipping_weight
		 FROM order_items WHERE order_id=$1`, o.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var oi models.OrderItem
		if err := rows.Scan(&oi.ID, &oi.ProductID, &oi.VariantID, &oi.Name, &oi.SKU, &oi.Quantity, &oi.UnitPrice, &oi.LineTotal, &oi.TaxAmount, &oi.TaxRate, &oi.TaxClassID,
			&oi.ShippingMethod, &oi.ShippingCost, &oi.ShippingWeight); err != nil {
			return nil, err
		}
		o.Items = append(o.Items, oi)
	}
	// Lazy auto-fulfill check: transition delivered → fulfilled if eligible
	if o.Status == "delivered" {
		if did, _ := s.CheckAndFulfillOrder(ctx, tenantID, orderID); did {
			o.Status = "fulfilled"
		}
	}
	return &o, nil
}

// GetOrderWithDetails returns an order with its items, shipping address, billing address,
// and payment metadata. Used by the order status pages.
func (s *Store) GetOrderWithDetails(ctx context.Context, tenantID, orderID uuid.UUID) (*models.OrderWithDetails, error) {
	var o models.OrderWithDetails
	var shippingAddr, billingAddr, historyJSON, taxBreakdownJSON []byte
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, user_id, status, subtotal, discount_total, shipping_total, tax_total,
		        grand_total, currency_code, shipping_address, billing_address,
		        COALESCE(tracking_number,''), COALESCE(carrier,''),
		        shipped_at, delivered_at, cancelled_at, COALESCE(cancel_reason,''),
		        COALESCE(internal_notes,''), COALESCE(payment_method,''), COALESCE(transaction_id,''),
		        COALESCE(shipping_method,''), shipping_weight, COALESCE(customer_email,''), COALESCE(customer_name,''),
		        status_history, created_at, updated_at,
		        replaces_order_id, return_id, COALESCE(order_tag,''), tax_breakdown, return_status
		 FROM orders WHERE id=$1 AND tenant_id=$2`,
		orderID, tenantID,
	).Scan(&o.ID, &o.TenantID, &o.UserID, &o.Status, &o.Subtotal, &o.DiscountTotal,
		&o.ShippingTotal, &o.TaxTotal, &o.GrandTotal, &o.CurrencyCode,
		&shippingAddr, &billingAddr,
		&o.TrackingNumber, &o.Carrier, &o.ShippedAt, &o.DeliveredAt, &o.CancelledAt, &o.CancelReason,
		&o.InternalNotes, &o.PaymentMethod, &o.TransactionID, &o.ShippingMethod, &o.ShippingWeight,
		&o.CustomerEmail, &o.CustomerName, &historyJSON, &o.CreatedAt, &o.UpdatedAt,
		&o.ReplacesOrderID, &o.ReturnID, &o.OrderTag, &taxBreakdownJSON, &o.ReturnStatus)
	if err != nil {
		return nil, err
	}
	if len(shippingAddr) > 0 {
		_ = json.Unmarshal(shippingAddr, &o.ShippingAddress)
	}
	if len(billingAddr) > 0 {
		_ = json.Unmarshal(billingAddr, &o.BillingAddress)
	}
	if len(historyJSON) > 0 {
		_ = json.Unmarshal(historyJSON, &o.StatusHistory)
	}
	if len(taxBreakdownJSON) > 0 {
		_ = json.Unmarshal(taxBreakdownJSON, &o.TaxBreakdown)
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT id, product_id, variant_id, name, sku, quantity, unit_price, line_total, tax_amount, tax_rate, tax_class_id,
		        shipping_method, shipping_cost, shipping_weight
		 FROM order_items WHERE order_id=$1`, o.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var oi models.OrderItem
		if err := rows.Scan(&oi.ID, &oi.ProductID, &oi.VariantID, &oi.Name, &oi.SKU, &oi.Quantity, &oi.UnitPrice, &oi.LineTotal, &oi.TaxAmount, &oi.TaxRate, &oi.TaxClassID,
			&oi.ShippingMethod, &oi.ShippingCost, &oi.ShippingWeight); err != nil {
			return nil, err
		}
		o.Items = append(o.Items, oi)
	}
	// Lazy auto-fulfill check: transition delivered → fulfilled if eligible
	if o.Status == "delivered" {
		if did, _ := s.CheckAndFulfillOrder(ctx, tenantID, orderID); did {
			o.Status = "fulfilled"
		}
	}
	return &o, nil
}

// UpdateOrderStatus transitions an order to a new status with workflow validation.
// It also updates timestamp fields (shipped_at, delivered_at, cancelled_at) and appends
// an event to the status_history JSONB array.
func (s *Store) UpdateOrderStatus(ctx context.Context, tenantID, orderID uuid.UUID, newStatus, note, actor string, trackingNumber, carrier string) (*models.Order, error) {
	// Fetch current order to validate transition
	var currentStatus string
	err := s.Pool.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1 AND tenant_id=$2`, orderID, tenantID).Scan(&currentStatus)
	if err != nil {
		return nil, err
	}

	// Validate the requested transition first (before auto-deliver may change it).
	if !models.IsValidOrderTransition(currentStatus, newStatus) {
		return nil, fmt.Errorf("invalid status transition: %s → %s", currentStatus, newStatus)
	}

	// Auto-deliver: if transitioning to 'processing' and no products require shipping,
	// skip 'shipped' and go directly to 'delivered'.
	if newStatus == "processing" {
		var allNoShipping bool
		err = s.Pool.QueryRow(ctx,
			`SELECT COALESCE(BOOL_AND(p.requires_shipping = false), false)
			 FROM order_items oi JOIN products p ON p.id = oi.product_id
			 WHERE oi.order_id=$1`, orderID).Scan(&allNoShipping)
		if err == nil && allNoShipping {
			newStatus = "delivered"
		}
	}

	now := time.Now()
	event := models.OrderStatusEvent{Status: newStatus, Timestamp: now, Actor: actor, Note: note}
	eventJSON, _ := json.Marshal(event)

	// Build SET clauses: $1=orderID, $2=tenantID, $3=newStatus, $4=eventJSON
	args := []interface{}{orderID, tenantID, newStatus, eventJSON}
	argIdx := 5
	setClauses := []string{"status=$3", "updated_at=NOW()", "status_history = status_history || $4::jsonb"}

	if trackingNumber != "" {
		setClauses = append(setClauses, fmt.Sprintf("tracking_number=$%d", argIdx))
		args = append(args, trackingNumber)
		argIdx++
	}
	if carrier != "" {
		setClauses = append(setClauses, fmt.Sprintf("carrier=$%d", argIdx))
		args = append(args, carrier)
		argIdx++
	}

	switch newStatus {
	case "shipped":
		setClauses = append(setClauses, fmt.Sprintf("shipped_at=$%d", argIdx))
		args = append(args, now)
		argIdx++
	case "delivered":
		setClauses = append(setClauses, fmt.Sprintf("delivered_at=$%d", argIdx))
		args = append(args, now)
		argIdx++
	case "cancelled":
		setClauses = append(setClauses, fmt.Sprintf("cancelled_at=$%d", argIdx))
		args = append(args, now)
		argIdx++
		if note != "" {
			setClauses = append(setClauses, fmt.Sprintf("cancel_reason=$%d", argIdx))
			args = append(args, note)
			argIdx++
		}
	}

	query := fmt.Sprintf(`UPDATE orders SET %s WHERE id=$1 AND tenant_id=$2`,
		strings.Join(setClauses, ", "))

	_, err = s.Pool.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	// Restore stock on cancellation
	if newStatus == "cancelled" {
		if err := s.restoreOrderStock(ctx, tenantID, orderID); err != nil {
			// Log but don't fail the status update
			_ = err
		}
	}

	// Return the updated order
	return s.GetOrderByID(ctx, tenantID, orderID)
}

// restoreOrderStock adds back the quantities of all order items to product/variant stock.
func (s *Store) restoreOrderStock(ctx context.Context, tenantID, orderID uuid.UUID) error {
	rows, err := s.Pool.Query(ctx,
		`SELECT product_id, variant_id, quantity FROM order_items WHERE order_id=$1`, orderID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var productID uuid.UUID
		var variantID *uuid.UUID
		var qty int
		if err := rows.Scan(&productID, &variantID, &qty); err != nil {
			return err
		}
		if variantID != nil {
			_, _ = s.Pool.Exec(ctx, `UPDATE variants SET stock = stock + $1 WHERE id=$2`, qty, *variantID)
		} else {
			_, _ = s.Pool.Exec(ctx, `UPDATE products SET stock = stock + $1 WHERE id=$2`, qty, productID)
		}
		// Record stock movement
		_, _ = s.Pool.Exec(ctx,
			`INSERT INTO stock_movements (tenant_id, product_id, variant_id, movement_type, quantity, reference)
			 VALUES ($1,$2,$3,'cancellation',$4,$5)`,
			tenantID, productID, variantID, qty, orderID.String())
	}
	return nil
}

// UpdateOrderNotes updates the internal notes on an order.
func (s *Store) UpdateOrderNotes(ctx context.Context, tenantID, orderID uuid.UUID, notes string) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE orders SET internal_notes=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		orderID, tenantID, notes)
	return err
}

// ============================================================
// Inventory Management
// ============================================================

// ListInventory returns all inventory items for a tenant, including variant-level stock.
func (s *Store) ListInventory(ctx context.Context, tenantID uuid.UUID, filter string) ([]models.InventoryItem, error) {
	var out []models.InventoryItem

	if filter == "variants" || filter == "all" {
		// Variant-level inventory
		rows, err := s.Pool.Query(ctx,
			`SELECT p.id, p.name, p.slug, p.sku, v.id, v.name, v.stock, p.low_stock_threshold, p.track_inventory
			 FROM products p
			 JOIN variants v ON v.product_id = p.id
			 WHERE p.tenant_id=$1
			 ORDER BY p.name, v.name`, tenantID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var item models.InventoryItem
			if err := rows.Scan(&item.ProductID, &item.ProductName, &item.ProductSlug, &item.SKU,
				&item.VariantID, &item.VariantName, &item.Stock, &item.LowStockThreshold, &item.TrackInventory); err != nil {
				return nil, err
			}
			item.IsOutOfStock = item.Stock <= 0
			item.IsLowStock = item.Stock > 0 && item.Stock <= item.LowStockThreshold
			out = append(out, item)
		}
		rows.Close()
	}

	if filter == "products" || filter == "all" || filter == "" {
		// Product-level inventory (products without variants)
		rows, err := s.Pool.Query(ctx,
			`SELECT p.id, p.name, p.slug, p.sku, p.stock, p.low_stock_threshold, p.track_inventory
			 FROM products p
			 WHERE p.tenant_id=$1
			   AND NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id)
			 ORDER BY p.name`, tenantID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var item models.InventoryItem
			if err := rows.Scan(&item.ProductID, &item.ProductName, &item.ProductSlug, &item.SKU,
				&item.Stock, &item.LowStockThreshold, &item.TrackInventory); err != nil {
				return nil, err
			}
			item.IsOutOfStock = item.Stock <= 0
			item.IsLowStock = item.Stock > 0 && item.Stock <= item.LowStockThreshold
			out = append(out, item)
		}
	}

	return out, nil
}

// AdjustStock adjusts the stock level for a product or variant and records a stock movement.
func (s *Store) AdjustStock(ctx context.Context, tenantID uuid.UUID, productID uuid.UUID, variantID *uuid.UUID, adjustment int, reason string, createdBy *uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if variantID != nil {
		tag, err := tx.Exec(ctx,
			`UPDATE variants SET stock = stock + $1 WHERE id=$2`,
			adjustment, *variantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return sql.ErrNoRows
		}
	} else {
		tag, err := tx.Exec(ctx,
			`UPDATE products SET stock = stock + $1 WHERE id=$2 AND tenant_id=$3`,
			adjustment, productID, tenantID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return sql.ErrNoRows
		}
	}

	movementType := "adjustment"
	if adjustment > 0 {
		movementType = "restock"
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO stock_movements (tenant_id, product_id, variant_id, movement_type, quantity, reason, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		tenantID, productID, variantID, movementType, adjustment, reason, createdBy)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SetStock sets the absolute stock level for a product or variant and records a stock movement.
func (s *Store) SetStock(ctx context.Context, tenantID uuid.UUID, productID uuid.UUID, variantID *uuid.UUID, newStock int, reason string, createdBy *uuid.UUID) error {
	// Get current stock to compute the delta
	var currentStock int
	if variantID != nil {
		err := s.Pool.QueryRow(ctx, `SELECT stock FROM variants WHERE id=$1`, *variantID).Scan(&currentStock)
		if err != nil {
			return err
		}
	} else {
		err := s.Pool.QueryRow(ctx, `SELECT stock FROM products WHERE id=$1 AND tenant_id=$2`, productID, tenantID).Scan(&currentStock)
		if err != nil {
			return err
		}
	}
	delta := newStock - currentStock
	if delta == 0 {
		return nil
	}
	return s.AdjustStock(ctx, tenantID, productID, variantID, delta, reason, createdBy)
}

// StockMovementFilter holds optional filters for listing stock movements.
type StockMovementFilter struct {
	MovementType string
	Search       string
	Dr           DateRangeFilter
}

// ListStockMovements returns recent stock movements for a tenant.
func (s *Store) ListStockMovements(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.StockMovement, int, error) {
	return s.ListStockMovementsFiltered(ctx, tenantID, StockMovementFilter{}, limit, offset)
}

func (s *Store) ListStockMovementsFiltered(ctx context.Context, tenantID uuid.UUID, f StockMovementFilter, limit, offset int) ([]models.StockMovement, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	where := "WHERE sm.tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if f.MovementType != "" {
		where += fmt.Sprintf(" AND sm.movement_type=$%d", argIdx)
		args = append(args, f.MovementType)
		argIdx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (p.name ILIKE $%d OR p.sku ILIKE $%d OR COALESCE(v.name,'') ILIKE $%d OR COALESCE(sm.reason,'') ILIKE $%d)", argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}
	drClause, args, argIdx := dateRangeClause("sm.created_at", f.Dr, args, argIdx)
	where += drClause

	var total int
	if err := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM stock_movements sm JOIN products p ON p.id = sm.product_id %s`, where), args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.Pool.Query(ctx,
		fmt.Sprintf(`SELECT sm.id, sm.tenant_id, sm.product_id, p.name, sm.variant_id, v.name,
		        sm.movement_type, sm.quantity, sm.reason, sm.reference, sm.created_by, sm.created_at
		 FROM stock_movements sm
		 JOIN products p ON p.id = sm.product_id
		 LEFT JOIN variants v ON v.id = sm.variant_id
		 %s
		 ORDER BY sm.created_at DESC
		 LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1),
		append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []models.StockMovement
	for rows.Next() {
		var m models.StockMovement
		var variantName *string
		var reason *string
		var reference *string
		if err := rows.Scan(&m.ID, &m.TenantID, &m.ProductID, &m.ProductName, &m.VariantID, &variantName,
			&m.MovementType, &m.Quantity, &reason, &reference, &m.CreatedBy, &m.CreatedAt); err != nil {
			return nil, 0, err
		}
		if variantName != nil {
			m.VariantName = *variantName
		}
		if reason != nil {
			m.Reason = *reason
		}
		if reference != nil {
			m.Reference = *reference
		}
		out = append(out, m)
	}
	return out, total, nil
}

// InventoryStats returns summary statistics for the inventory dashboard.
func (s *Store) InventoryStats(ctx context.Context, tenantID uuid.UUID) (*models.InventoryStats, error) {
	stats := &models.InventoryStats{}
	// Count variant-level items
	err := s.Pool.QueryRow(ctx,
		`SELECT
			COUNT(*) FILTER (WHERE v.stock <= 0),
			COUNT(*) FILTER (WHERE v.stock > 0 AND v.stock <= p.low_stock_threshold),
			COUNT(*) FILTER (WHERE v.stock > p.low_stock_threshold),
			COALESCE(SUM(v.stock * v.price), 0)
		 FROM variants v
		 JOIN products p ON p.id = v.product_id
		 WHERE p.tenant_id=$1`, tenantID).
		Scan(&stats.OutOfStock, &stats.LowStock, &stats.InStock, &stats.TotalStockValue)
	if err != nil {
		return nil, err
	}
	// Add product-level items (no variants)
	var prodOutOf, prodLow, prodIn int
	var prodValue float64
	err = s.Pool.QueryRow(ctx,
		`SELECT
			COUNT(*) FILTER (WHERE p.stock <= 0),
			COUNT(*) FILTER (WHERE p.stock > 0 AND p.stock <= p.low_stock_threshold),
			COUNT(*) FILTER (WHERE p.stock > p.low_stock_threshold),
			COALESCE(SUM(p.stock * p.base_price), 0)
		 FROM products p
		 WHERE p.tenant_id=$1
		   AND NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id)`, tenantID).
		Scan(&prodOutOf, &prodLow, &prodIn, &prodValue)
	if err != nil {
		return nil, err
	}
	stats.OutOfStock += prodOutOf
	stats.LowStock += prodLow
	stats.InStock += prodIn
	stats.TotalStockValue += prodValue
	stats.TotalSKUs = stats.OutOfStock + stats.LowStock + stats.InStock
	return stats, nil
}

// ============================================================
// Vendor Management
// ============================================================

func (s *Store) ListVendors(ctx context.Context, tenantID uuid.UUID) ([]models.Vendor, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT v.id, v.tenant_id, v.name, v.slug, COALESCE(v.email,''), COALESCE(v.phone,''), COALESCE(v.address,''), COALESCE(v.contact_person,''),
		        v.commission_rate, v.status, COALESCE(v.notes,''), v.created_at, v.updated_at,
		        (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) AS product_count
		 FROM vendors v
		 WHERE v.tenant_id=$1
		 ORDER BY v.name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Vendor
	for rows.Next() {
		var v models.Vendor
		if err := rows.Scan(&v.ID, &v.TenantID, &v.Name, &v.Slug, &v.Email, &v.Phone, &v.Address,
			&v.ContactPerson, &v.CommissionRate, &v.Status, &v.Notes, &v.CreatedAt, &v.UpdatedAt, &v.ProductCount); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, nil
}

func (s *Store) GetVendor(ctx context.Context, tenantID, id uuid.UUID) (*models.Vendor, error) {
	v := &models.Vendor{}
	err := s.Pool.QueryRow(ctx,
		`SELECT v.id, v.tenant_id, v.name, v.slug, COALESCE(v.email,''), COALESCE(v.phone,''), COALESCE(v.address,''), COALESCE(v.contact_person,''),
		        v.commission_rate, v.status, COALESCE(v.notes,''), v.created_at, v.updated_at,
		        (SELECT COUNT(*) FROM products p WHERE p.vendor_id = v.id) AS product_count
		 FROM vendors v
		 WHERE v.id=$1 AND v.tenant_id=$2`, id, tenantID).
		Scan(&v.ID, &v.TenantID, &v.Name, &v.Slug, &v.Email, &v.Phone, &v.Address,
			&v.ContactPerson, &v.CommissionRate, &v.Status, &v.Notes, &v.CreatedAt, &v.UpdatedAt, &v.ProductCount)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (s *Store) CreateVendor(ctx context.Context, v *models.Vendor) (*models.Vendor, error) {
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO vendors (tenant_id, name, slug, email, phone, address, contact_person, commission_rate, status, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id, tenant_id, name, slug, COALESCE(email,''), COALESCE(phone,''), COALESCE(address,''), COALESCE(contact_person,''), commission_rate, status, COALESCE(notes,''), created_at, updated_at`,
		v.TenantID, v.Name, v.Slug, v.Email, v.Phone, v.Address, v.ContactPerson, v.CommissionRate, v.Status, v.Notes).
		Scan(&v.ID, &v.TenantID, &v.Name, &v.Slug, &v.Email, &v.Phone, &v.Address,
			&v.ContactPerson, &v.CommissionRate, &v.Status, &v.Notes, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (s *Store) UpdateVendor(ctx context.Context, v *models.Vendor) (*models.Vendor, error) {
	err := s.Pool.QueryRow(ctx,
		`UPDATE vendors SET name=$3, slug=$4, email=$5, phone=$6, address=$7, contact_person=$8,
		        commission_rate=$9, status=$10, notes=$11, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2
		 RETURNING id, tenant_id, name, slug, COALESCE(email,''), COALESCE(phone,''), COALESCE(address,''), COALESCE(contact_person,''), commission_rate, status, COALESCE(notes,''), created_at, updated_at`,
		v.ID, v.TenantID, v.Name, v.Slug, v.Email, v.Phone, v.Address, v.ContactPerson, v.CommissionRate, v.Status, v.Notes).
		Scan(&v.ID, &v.TenantID, &v.Name, &v.Slug, &v.Email, &v.Phone, &v.Address,
			&v.ContactPerson, &v.CommissionRate, &v.Status, &v.Notes, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return v, nil
}

func (s *Store) DeleteVendor(ctx context.Context, tenantID, id uuid.UUID) error {
	// Unlink products first
	_, _ = s.Pool.Exec(ctx, `UPDATE products SET vendor_id=NULL WHERE vendor_id=$1 AND tenant_id=$2`, id, tenantID)
	tag, err := s.Pool.Exec(ctx, `DELETE FROM vendors WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ============================================================
// Permissions Management
// ============================================================

// ListPermissions returns the full permission catalog.
func (s *Store) ListPermissions(ctx context.Context) ([]models.Permission, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, code, module, action, description, created_at FROM permissions ORDER BY module, action`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.Permission
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(&p.ID, &p.Code, &p.Module, &p.Action, &p.Description, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// ListRolePermissions returns all role-permission mappings for a tenant,
// joined with the permission catalog for convenience.
func (s *Store) ListRolePermissions(ctx context.Context, tenantID uuid.UUID) ([]models.RolePermission, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT rp.id, rp.tenant_id, rp.role, rp.permission_id, rp.granted, rp.created_at,
		        p.code, p.module, p.description
		 FROM role_permissions rp
		 JOIN permissions p ON p.id = rp.permission_id
		 WHERE rp.tenant_id=$1
		 ORDER BY rp.role, p.module, p.action`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.RolePermission
	for rows.Next() {
		var rp models.RolePermission
		if err := rows.Scan(&rp.ID, &rp.TenantID, &rp.Role, &rp.PermissionID, &rp.Granted, &rp.CreatedAt,
			&rp.PermissionCode, &rp.PermissionModule, &rp.PermissionDescription); err != nil {
			return nil, err
		}
		out = append(out, rp)
	}
	return out, nil
}

// GetRolePermissions returns the set of permission codes granted to a role within a tenant.
func (s *Store) GetRolePermissions(ctx context.Context, tenantID uuid.UUID, role models.UserRole) ([]models.RolePermission, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT rp.id, rp.tenant_id, rp.role, rp.permission_id, rp.granted, rp.created_at,
		        p.code, p.module, p.description
		 FROM role_permissions rp
		 JOIN permissions p ON p.id = rp.permission_id
		 WHERE rp.tenant_id=$1 AND rp.role=$2 AND rp.granted=TRUE
		 ORDER BY p.module, p.action`, tenantID, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.RolePermission
	for rows.Next() {
		var rp models.RolePermission
		if err := rows.Scan(&rp.ID, &rp.TenantID, &rp.Role, &rp.PermissionID, &rp.Granted, &rp.CreatedAt,
			&rp.PermissionCode, &rp.PermissionModule, &rp.PermissionDescription); err != nil {
			return nil, err
		}
		out = append(out, rp)
	}
	return out, nil
}

// SetRolePermission grants or denies a permission for a role within a tenant (upsert).
func (s *Store) SetRolePermission(ctx context.Context, tenantID uuid.UUID, role models.UserRole, permissionID uuid.UUID, granted bool) error {
	_, err := s.Pool.Exec(ctx,
		`INSERT INTO role_permissions (tenant_id, role, permission_id, granted)
		 VALUES ($1,$2,$3,$4)
		 ON CONFLICT (tenant_id, role, permission_id) DO UPDATE SET granted=EXCLUDED.granted`,
		tenantID, role, permissionID, granted)
	return err
}

// SetRolePermissions bulk sets permissions for a role within a tenant.
// This replaces all existing permissions for that role with the provided set.
func (s *Store) SetRolePermissions(ctx context.Context, tenantID uuid.UUID, role models.UserRole, permissionIDs []uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Clear existing grants for this role
	if _, err := tx.Exec(ctx, `DELETE FROM role_permissions WHERE tenant_id=$1 AND role=$2`, tenantID, role); err != nil {
		return err
	}
	// Insert new grants
	for _, pid := range permissionIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO role_permissions (tenant_id, role, permission_id, granted) VALUES ($1,$2,$3,TRUE)
			 ON CONFLICT DO NOTHING`, tenantID, role, pid); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// GetUserPermissions returns the set of permission codes granted to the user's role
// within their tenant. Superadmin always gets all permissions (handled by caller).
func (s *Store) GetUserPermissions(ctx context.Context, tenantID uuid.UUID, role models.UserRole) ([]string, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT p.code FROM role_permissions rp
		 JOIN permissions p ON p.id = rp.permission_id
		 WHERE rp.tenant_id=$1 AND rp.role=$2 AND rp.granted=TRUE`, tenantID, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var codes []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	return codes, nil
}

// SeedDefaultPermissions seeds the default permissions for business_admin and staff
// for a tenant if no role_permissions exist yet for that tenant.
func (s *Store) SeedDefaultPermissions(ctx context.Context, tenantID uuid.UUID) error {
	// Check if already seeded
	var count int
	err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM role_permissions WHERE tenant_id=$1`, tenantID).Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	// Get all permission IDs
	perms, err := s.ListPermissions(ctx)
	if err != nil {
		return err
	}

	// business_admin gets all permissions
	var adminPermIDs []uuid.UUID
	for _, p := range perms {
		adminPermIDs = append(adminPermIDs, p.ID)
	}
	if err := s.SetRolePermissions(ctx, tenantID, models.RoleBusinessAdmin, adminPermIDs); err != nil {
		return err
	}

	// staff gets read-only + order management + inventory view
	staffAllowed := map[string]bool{
		"dashboard.view":   true,
		"products.view":    true,
		"inventory.view":   true,
		"vendors.view":     true,
		"offers.view":      true,
		"discounts.view":   true,
		"orders.view":      true,
		"orders.update":    true,
		"customers.view":   true,
		"tax.view":         true,
		"shipping.view":    true,
		"payments.view":    true,
		"settings.view":    true,
	}
	var staffPermIDs []uuid.UUID
	for _, p := range perms {
		if staffAllowed[p.Code] {
			staffPermIDs = append(staffPermIDs, p.ID)
		}
	}
	return s.SetRolePermissions(ctx, tenantID, models.RoleStaff, staffPermIDs)
}

// ---------------- Contact Submissions ----------------

type ContactSubmission struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Subject   string    `json:"subject"`
	Message   string    `json:"message"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) CreateContactSubmission(ctx context.Context, tenantID uuid.UUID, name, email, phone, subject, message string) (*ContactSubmission, error) {
	var sub ContactSubmission
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO contact_submissions (tenant_id, name, email, phone, subject, message)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, tenant_id, name, email, phone, subject, message, is_read, created_at`,
		tenantID, name, email, phone, subject, message,
	).Scan(&sub.ID, &sub.TenantID, &sub.Name, &sub.Email, &sub.Phone, &sub.Subject, &sub.Message, &sub.IsRead, &sub.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (s *Store) ListContactSubmissions(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]ContactSubmission, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM contact_submissions WHERE tenant_id=$1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT id, tenant_id, name, email, phone, subject, message, is_read, created_at
		FROM contact_submissions WHERE tenant_id=$1
		ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []ContactSubmission
	for rows.Next() {
		var sub ContactSubmission
		if err := rows.Scan(&sub.ID, &sub.TenantID, &sub.Name, &sub.Email, &sub.Phone, &sub.Subject, &sub.Message, &sub.IsRead, &sub.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, sub)
	}
	if out == nil {
		out = []ContactSubmission{}
	}
	return out, total, nil
}

func (s *Store) MarkContactSubmissionRead(ctx context.Context, tenantID, submissionID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `UPDATE contact_submissions SET is_read=true WHERE id=$1 AND tenant_id=$2`, submissionID, tenantID)
	return err
}

func (s *Store) DeleteContactSubmission(ctx context.Context, tenantID, submissionID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM contact_submissions WHERE id=$1 AND tenant_id=$2`, submissionID, tenantID)
	return err
}
