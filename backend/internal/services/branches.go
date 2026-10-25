package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"math"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
)

// ============================================================
// Branches (multi-outlet support)
// ============================================================

const branchColumns = `id, tenant_id, name, slug, phone, email, line1, line2, city, state,
	postal_code, country, center_lat, center_lng, radius_km, areas, is_active, is_default,
	sort_order, created_at, updated_at`

func scanBranch(row pgx.Row) (*models.Branch, error) {
	b := &models.Branch{}
	var areas []byte
	err := row.Scan(&b.ID, &b.TenantID, &b.Name, &b.Slug, &b.Phone, &b.Email, &b.Line1, &b.Line2,
		&b.City, &b.State, &b.PostalCode, &b.Country, &b.CenterLat, &b.CenterLng, &b.RadiusKm,
		&areas, &b.IsActive, &b.IsDefault, &b.SortOrder, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if len(areas) > 0 {
		_ = json.Unmarshal(areas, &b.Areas)
	}
	if b.Areas == nil {
		b.Areas = []string{}
	}
	return b, nil
}

func scanBranchRows(rows pgx.Rows) ([]models.Branch, error) {
	defer rows.Close()
	out := []models.Branch{}
	for rows.Next() {
		b, err := scanBranch(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *b)
	}
	return out, nil
}

// ListBranches returns all branches for a tenant (admin view — includes inactive).
func (s *Store) ListBranches(ctx context.Context, tenantID uuid.UUID) ([]models.Branch, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+branchColumns+` FROM branches WHERE tenant_id=$1 ORDER BY sort_order, name`, tenantID)
	if err != nil {
		return nil, err
	}
	return scanBranchRows(rows)
}

// ListActiveBranches returns only active branches (public storefront view).
func (s *Store) ListActiveBranches(ctx context.Context, tenantID uuid.UUID) ([]models.Branch, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+branchColumns+` FROM branches WHERE tenant_id=$1 AND is_active=TRUE ORDER BY sort_order, name`, tenantID)
	if err != nil {
		return nil, err
	}
	return scanBranchRows(rows)
}

func (s *Store) GetBranch(ctx context.Context, tenantID, id uuid.UUID) (*models.Branch, error) {
	return scanBranch(s.Pool.QueryRow(ctx,
		`SELECT `+branchColumns+` FROM branches WHERE id=$1 AND tenant_id=$2`, id, tenantID))
}

func (s *Store) GetBranchBySlug(ctx context.Context, tenantID uuid.UUID, slug string) (*models.Branch, error) {
	return scanBranch(s.Pool.QueryRow(ctx,
		`SELECT `+branchColumns+` FROM branches WHERE slug=$1 AND tenant_id=$2`, slug, tenantID))
}

func (s *Store) GetDefaultBranch(ctx context.Context, tenantID uuid.UUID) (*models.Branch, error) {
	return scanBranch(s.Pool.QueryRow(ctx,
		`SELECT `+branchColumns+` FROM branches WHERE tenant_id=$1 AND is_default=TRUE`, tenantID))
}

func (s *Store) CreateBranch(ctx context.Context, b *models.Branch) error {
	areasJSON, err := jsonMarshal(b.Areas)
	if err != nil {
		return err
	}
	return s.Pool.QueryRow(ctx,
		`INSERT INTO branches (tenant_id, name, slug, phone, email, line1, line2, city, state,
			postal_code, country, center_lat, center_lng, radius_km, areas, is_active, is_default, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
		 RETURNING id, created_at, updated_at`,
		b.TenantID, b.Name, b.Slug, b.Phone, b.Email, b.Line1, b.Line2, b.City, b.State,
		b.PostalCode, b.Country, b.CenterLat, b.CenterLng, b.RadiusKm, areasJSON,
		b.IsActive, b.IsDefault, b.SortOrder).
		Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

func (s *Store) UpdateBranch(ctx context.Context, b *models.Branch) error {
	areasJSON, err := jsonMarshal(b.Areas)
	if err != nil {
		return err
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE branches SET name=$3, slug=$4, phone=$5, email=$6, line1=$7, line2=$8, city=$9,
			state=$10, postal_code=$11, country=$12, center_lat=$13, center_lng=$14, radius_km=$15,
			areas=$16, is_active=$17, is_default=$18, sort_order=$19, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		b.ID, b.TenantID, b.Name, b.Slug, b.Phone, b.Email, b.Line1, b.Line2, b.City, b.State,
		b.PostalCode, b.Country, b.CenterLat, b.CenterLng, b.RadiusKm, areasJSON,
		b.IsActive, b.IsDefault, b.SortOrder)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteBranch removes a branch. Related rows (orders, users, stock movements)
// keep their data with branch_id set to NULL via ON DELETE SET NULL.
func (s *Store) DeleteBranch(ctx context.Context, tenantID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM branches WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// SetDefaultBranch marks one branch as the store default (clears the flag on others).
func (s *Store) SetDefaultBranch(ctx context.Context, tenantID, id uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE branches SET is_default=FALSE WHERE tenant_id=$1`, tenantID); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE branches SET is_default=TRUE, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	return tx.Commit(ctx)
}

// ---------------- Delivery-area resolution ----------------

// HaversineKm is the great-circle distance in kilometres between two points.
func HaversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * R * math.Asin(math.Sqrt(a))
}

// Covers reports whether the branch's service circle covers the given point.
func branchCoversPoint(b *models.Branch, lat, lng float64) bool {
	if b.RadiusKm <= 0 {
		return false
	}
	return HaversineKm(lat, lng, b.CenterLat, b.CenterLng) <= b.RadiusKm
}

// BranchCoversArea reports whether the branch's named area list contains the name.
func branchCoversArea(b *models.Branch, name string) bool {
	n := strings.ToLower(strings.TrimSpace(name))
	for _, a := range b.Areas {
		if strings.ToLower(strings.TrimSpace(a)) == n {
			return true
		}
	}
	return false
}

// BranchMatch pairs a branch that can fulfil a delivery with its distance
// from the checked point (nil when matched by named area, not coordinates).
type BranchMatch struct {
	Branch     *models.Branch `json:"branch"`
	DistanceKm *float64       `json:"distance_km,omitempty"`
}

// ServiceableBranches returns every active branch whose service circle covers
// the point, sorted nearest-first — the customer is auto-assigned to [0] but
// may switch to any other eligible branch.
func (s *Store) ServiceableBranches(ctx context.Context, tenantID uuid.UUID, lat, lng float64) ([]BranchMatch, error) {
	branches, err := s.ListActiveBranches(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := []BranchMatch{}
	for i := range branches {
		b := &branches[i]
		if b.RadiusKm <= 0 {
			continue
		}
		if d := HaversineKm(lat, lng, b.CenterLat, b.CenterLng); d <= b.RadiusKm {
			dist := d
			out = append(out, BranchMatch{Branch: b, DistanceKm: &dist})
		}
	}
	sort.Slice(out, func(i, j int) bool { return *out[i].DistanceKm < *out[j].DistanceKm })
	return out, nil
}

// BranchesCoveringArea returns every active branch whose named area list
// contains the name (stable order: sort_order, name).
func (s *Store) BranchesCoveringArea(ctx context.Context, tenantID uuid.UUID, name string) ([]BranchMatch, error) {
	branches, err := s.ListActiveBranches(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := []BranchMatch{}
	for i := range branches {
		if branchCoversArea(&branches[i], name) {
			out = append(out, BranchMatch{Branch: &branches[i]})
		}
	}
	return out, nil
}

// ResolveDeliveryBranch picks the branch that should fulfil a delivery:
// coordinates first (nearest covering branch wins), then a named-area match.
// Returns (nil, nil) when no branch covers the location, or when no branches
// are configured at all.
func (s *Store) ResolveDeliveryBranch(ctx context.Context, tenantID uuid.UUID, lat, lng *float64, area string) (*models.Branch, error) {
	if lat != nil && lng != nil {
		matches, err := s.ServiceableBranches(ctx, tenantID, *lat, *lng)
		if err != nil {
			return nil, err
		}
		if len(matches) > 0 {
			return matches[0].Branch, nil
		}
	}
	if area != "" {
		matches, err := s.BranchesCoveringArea(ctx, tenantID, area)
		if err != nil {
			return nil, err
		}
		if len(matches) > 0 {
			return matches[0].Branch, nil
		}
	}
	return nil, nil
}

// HasActiveBranches reports whether the store has at least one active branch —
// when true, delivery enforcement applies at checkout.
func (s *Store) HasActiveBranches(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	var n int
	err := s.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM branches WHERE tenant_id=$1 AND is_active=TRUE`, tenantID).Scan(&n)
	return n > 0, err
}

// GetOrderBranchID returns the branch assigned to an order (nil = unassigned).
func (s *Store) GetOrderBranchID(ctx context.Context, tenantID, orderID uuid.UUID) (*uuid.UUID, error) {
	var branchID *uuid.UUID
	err := s.Pool.QueryRow(ctx,
		`SELECT branch_id FROM orders WHERE id=$1 AND tenant_id=$2`, orderID, tenantID).Scan(&branchID)
	return branchID, err
}

// OrderInBranch reports whether an order belongs to the given branch —
// used to gate branch-scoped staff from other branches' orders.
func (s *Store) OrderInBranch(ctx context.Context, tenantID, orderID, branchID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM orders WHERE id=$1 AND tenant_id=$2 AND branch_id=$3)`,
		orderID, tenantID, branchID).Scan(&ok)
	return ok, err
}

// ---------------- Per-branch stock ----------------

// ListBranchInventory returns inventory rows for one branch. When a
// branch_stock row exists it overrides the store-level stock figure;
// otherwise the shared store-level stock is shown.
func (s *Store) ListBranchInventory(ctx context.Context, tenantID, branchID uuid.UUID, filter string) ([]models.InventoryItem, error) {
	var out []models.InventoryItem

	if filter == "variants" || filter == "all" {
		rows, err := s.Pool.Query(ctx,
			`SELECT p.id, p.name, p.slug, p.sku, v.id, v.name,
			        COALESCE(bs.stock, v.stock), bs.stock IS NOT NULL,
			        p.low_stock_threshold, p.track_inventory
			 FROM products p
			 JOIN variants v ON v.product_id = p.id
			 LEFT JOIN branch_stock bs ON bs.branch_id=$2 AND bs.variant_id = v.id
			 WHERE p.tenant_id=$1
			 ORDER BY p.name, v.name`, tenantID, branchID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item models.InventoryItem
			if err := rows.Scan(&item.ProductID, &item.ProductName, &item.ProductSlug, &item.SKU,
				&item.VariantID, &item.VariantName, &item.Stock, &item.BranchManaged,
				&item.LowStockThreshold, &item.TrackInventory); err != nil {
				rows.Close()
				return nil, err
			}
			item.IsOutOfStock = item.Stock <= 0
			item.IsLowStock = item.Stock > 0 && item.Stock <= item.LowStockThreshold
			out = append(out, item)
		}
		rows.Close()
	}

	if filter == "products" || filter == "all" || filter == "" {
		rows, err := s.Pool.Query(ctx,
			`SELECT p.id, p.name, p.slug, p.sku,
			        COALESCE(bs.stock, p.stock), bs.stock IS NOT NULL,
			        p.low_stock_threshold, p.track_inventory
			 FROM products p
			 LEFT JOIN branch_stock bs ON bs.branch_id=$2 AND bs.product_id=p.id AND bs.variant_id IS NULL
			 WHERE p.tenant_id=$1
			   AND NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id)
			 ORDER BY p.name`, tenantID, branchID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item models.InventoryItem
			if err := rows.Scan(&item.ProductID, &item.ProductName, &item.ProductSlug, &item.SKU,
				&item.Stock, &item.BranchManaged, &item.LowStockThreshold, &item.TrackInventory); err != nil {
				rows.Close()
				return nil, err
			}
			item.IsOutOfStock = item.Stock <= 0
			item.IsLowStock = item.Stock > 0 && item.Stock <= item.LowStockThreshold
			out = append(out, item)
		}
		rows.Close()
	}

	return out, nil
}

// SetBranchStock upserts the per-branch stock level for a product or variant
// and records a stock movement tagged with the branch.
func (s *Store) SetBranchStock(ctx context.Context, tenantID, branchID, productID uuid.UUID, variantID *uuid.UUID, newStock int, reason string, createdBy *uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var current int
	var exists bool
	err = tx.QueryRow(ctx,
		`SELECT stock, TRUE FROM branch_stock
		 WHERE branch_id=$1 AND product_id=$2 AND variant_id IS NOT DISTINCT FROM $3`,
		branchID, productID, variantID).Scan(&current, &exists)
	if err != nil && err != pgx.ErrNoRows {
		return err
	}
	delta := newStock - current
	if exists && delta == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO branch_stock (tenant_id, branch_id, product_id, variant_id, stock)
		 VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (branch_id, product_id, variant_id)
		 DO UPDATE SET stock=$5, updated_at=NOW()`,
		tenantID, branchID, productID, variantID, newStock); err != nil {
		return err
	}

	movementType := "adjustment"
	if delta > 0 {
		movementType = "restock"
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO stock_movements (tenant_id, product_id, variant_id, branch_id, movement_type, quantity, reason, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		tenantID, productID, variantID, branchID, movementType, delta, reason, createdBy); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// BranchStockLevel returns the branch-managed stock for an item, if a
// branch_stock row exists (nil = item draws from shared stock).
func (s *Store) branchStockLevel(ctx context.Context, tx pgx.Tx, branchID, productID uuid.UUID, variantID *uuid.UUID) (*int, error) {
	var stock int
	err := tx.QueryRow(ctx,
		`SELECT stock FROM branch_stock WHERE branch_id=$1 AND product_id=$2 AND variant_id IS NOT DISTINCT FROM $3`,
		branchID, productID, variantID).Scan(&stock)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &stock, nil
}

// ---------------- JSON helpers ----------------

func jsonMarshal(v interface{}) ([]byte, error) {
	return pgxJSONMarshal(v)
}
