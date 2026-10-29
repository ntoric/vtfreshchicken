package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
)

// Module codes for the store feature flags managed under
// Backoffice → Developer → Modules & Features.
const (
	ModuleReturns     = "returns"
	ModuleTax         = "tax"
	ModuleShipping    = "shipping"
	ModulePromotions  = "promotions"
	ModuleDiscounts   = "discounts"
	ModulePageBuilder = "page_builder"
)

// defaultModuleSeeds mirrors the seeds in migration 0043 so that stores
// created after that migration (via the setup wizard) get the same rows.
var defaultModuleSeeds = []struct {
	code        string
	name        string
	description string
	sortOrder   int
}{
	{ModuleReturns, "Returns & Refunds", "Customer return, refund, and replacement requests plus the backoffice returns workspace.", 10},
	{ModuleTax, "Tax", "Tax classes, zones, and rates; tax calculation at checkout and tax settings in the backoffice.", 20},
	{ModuleShipping, "Shipping", "Shipping methods, zones, rates, and carrier shipments; delivery method selection at checkout.", 30},
	{ModulePromotions, "Promotions", "Storefront offers and promotional pricing applied to products.", 40},
	{ModuleDiscounts, "Discounts", "Discount codes and the coupon field at checkout.", 50},
	{ModulePageBuilder, "Page Builder", "Custom storefront pages built with the page builder and served under /p/:slug.", 60},
}

// EnsureDefaultModules inserts module rows for any built-in module that
// doesn't have one yet. Existing rows are never modified.
func (s *Store) EnsureDefaultModules(ctx context.Context, tenantID uuid.UUID) error {
	for _, m := range defaultModuleSeeds {
		if _, err := s.Pool.Exec(ctx,
			`INSERT INTO store_modules (tenant_id, module_code, display_name, description, is_enabled, sort_order)
			 VALUES ($1,$2,$3,$4,TRUE,$5)
			 ON CONFLICT (tenant_id, module_code) DO NOTHING`,
			tenantID, m.code, m.name, m.description, m.sortOrder); err != nil {
			return err
		}
	}
	return nil
}

// ListModules returns all module flags for the tenant, ordered by sort_order.
func (s *Store) ListModules(ctx context.Context, tenantID uuid.UUID) ([]models.StoreModule, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, module_code, display_name, COALESCE(description,''), is_enabled,
		        sort_order, created_at, updated_at
		 FROM store_modules WHERE tenant_id=$1 ORDER BY sort_order ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.StoreModule, 0)
	for rows.Next() {
		var m models.StoreModule
		if err := rows.Scan(&m.ID, &m.TenantID, &m.ModuleCode, &m.DisplayName, &m.Description,
			&m.IsEnabled, &m.SortOrder, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, nil
}

// ModuleEnabledMap returns module_code → is_enabled for every known module.
// Missing rows are seeded first so a freshly created store reports all
// modules enabled. Unknown module codes are absent from the map — callers
// should treat an absent code as enabled.
func (s *Store) ModuleEnabledMap(ctx context.Context, tenantID uuid.UUID) (map[string]bool, error) {
	if err := s.EnsureDefaultModules(ctx, tenantID); err != nil {
		return nil, err
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT module_code, is_enabled FROM store_modules WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]bool)
	for rows.Next() {
		var code string
		var enabled bool
		if err := rows.Scan(&code, &enabled); err != nil {
			return nil, err
		}
		out[code] = enabled
	}
	return out, nil
}

// IsModuleEnabled reports whether a module is enabled for the store.
// Defaults to true when the lookup fails or the code is unknown, so a
// storage hiccup never silently disables storefront features.
func (s *Store) IsModuleEnabled(ctx context.Context, tenantID uuid.UUID, code string) bool {
	var enabled bool
	err := s.Pool.QueryRow(ctx,
		`SELECT is_enabled FROM store_modules WHERE tenant_id=$1 AND module_code=$2`,
		tenantID, code).Scan(&enabled)
	if err != nil {
		if err == pgx.ErrNoRows {
			return true
		}
		return true
	}
	return enabled
}

// SetModuleEnabled toggles a module and returns the updated row.
func (s *Store) SetModuleEnabled(ctx context.Context, tenantID uuid.UUID, code string, enabled bool) (*models.StoreModule, error) {
	var m models.StoreModule
	err := s.Pool.QueryRow(ctx,
		`UPDATE store_modules SET is_enabled=$3
		 WHERE tenant_id=$1 AND module_code=$2
		 RETURNING id, tenant_id, module_code, display_name, COALESCE(description,''), is_enabled, sort_order, created_at, updated_at`,
		tenantID, code, enabled).
		Scan(&m.ID, &m.TenantID, &m.ModuleCode, &m.DisplayName, &m.Description,
			&m.IsEnabled, &m.SortOrder, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}
