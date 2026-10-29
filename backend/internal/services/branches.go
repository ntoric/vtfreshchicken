package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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
	postal_code, country, center_lat, center_lng, radius_km, service_zones, areas, is_active, is_default,
	sort_order, created_at, updated_at`

func scanBranch(row pgx.Row) (*models.Branch, error) {
	b := &models.Branch{}
	var areas, zones []byte
	err := row.Scan(&b.ID, &b.TenantID, &b.Name, &b.Slug, &b.Phone, &b.Email, &b.Line1, &b.Line2,
		&b.City, &b.State, &b.PostalCode, &b.Country, &b.CenterLat, &b.CenterLng, &b.RadiusKm,
		&zones, &areas, &b.IsActive, &b.IsDefault, &b.SortOrder, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if len(areas) > 0 {
		_ = json.Unmarshal(areas, &b.Areas)
	}
	if b.Areas == nil {
		b.Areas = []string{}
	}
	if len(zones) > 0 {
		_ = json.Unmarshal(zones, &b.ServiceZones)
	}
	b.ServiceZones = NormalizeServiceZones(b.ServiceZones)
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
	items, _, err := s.ListBranchesPaged(ctx, tenantID, 0, 0)
	return items, err
}

// ListBranchesPaged returns a page of branches plus the total count.
// limit <= 0 returns all rows.
func (s *Store) ListBranchesPaged(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.Branch, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM branches WHERE tenant_id=$1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}
	q, args := pageClause(
		`SELECT `+branchColumns+` FROM branches WHERE tenant_id=$1 ORDER BY sort_order, name`,
		[]interface{}{tenantID}, limit, offset)
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	items, err := scanBranchRows(rows)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
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
	b.ServiceZones = NormalizeServiceZones(b.ServiceZones)
	areasJSON, err := jsonMarshal(b.Areas)
	if err != nil {
		return err
	}
	zonesJSON, err := jsonMarshal(b.ServiceZones)
	if err != nil {
		return err
	}
	return s.Pool.QueryRow(ctx,
		`INSERT INTO branches (tenant_id, name, slug, phone, email, line1, line2, city, state,
			postal_code, country, center_lat, center_lng, radius_km, service_zones, areas, is_active, is_default, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
		 RETURNING id, created_at, updated_at`,
		b.TenantID, b.Name, b.Slug, b.Phone, b.Email, b.Line1, b.Line2, b.City, b.State,
		b.PostalCode, b.Country, b.CenterLat, b.CenterLng, b.RadiusKm, zonesJSON, areasJSON,
		b.IsActive, b.IsDefault, b.SortOrder).
		Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

func (s *Store) UpdateBranch(ctx context.Context, b *models.Branch) error {
	b.ServiceZones = NormalizeServiceZones(b.ServiceZones)
	areasJSON, err := jsonMarshal(b.Areas)
	if err != nil {
		return err
	}
	zonesJSON, err := jsonMarshal(b.ServiceZones)
	if err != nil {
		return err
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE branches SET name=$3, slug=$4, phone=$5, email=$6, line1=$7, line2=$8, city=$9,
			state=$10, postal_code=$11, country=$12, center_lat=$13, center_lng=$14, radius_km=$15,
			service_zones=$16, areas=$17, is_active=$18, is_default=$19, sort_order=$20, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		b.ID, b.TenantID, b.Name, b.Slug, b.Phone, b.Email, b.Line1, b.Line2, b.City, b.State,
		b.PostalCode, b.Country, b.CenterLat, b.CenterLng, b.RadiusKm, zonesJSON, areasJSON,
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

// NormalizeServiceZones cleans up a zone list for storage: drops non-positive
// radii, validates the charge type, clamps negative charges and sorts the
// rings ascending by radius so lookup is a linear scan from the centre out.
func NormalizeServiceZones(zones []models.ServiceZone) []models.ServiceZone {
	out := make([]models.ServiceZone, 0, len(zones))
	for _, z := range zones {
		if z.RadiusKm <= 0 {
			continue
		}
		switch z.ChargeType {
		case "flat", "per_km":
		default:
			z.ChargeType = "free"
		}
		if z.ChargeType == "free" || z.Charge < 0 {
			z.Charge = 0
		}
		z.Label = strings.TrimSpace(z.Label)
		out = append(out, z)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].RadiusKm < out[j].RadiusKm })
	return out
}

// BranchEffectiveRadiusKm is the branch's outer delivery boundary: the
// outermost service ring when zones are configured, otherwise the plain
// radius_km circle.
func BranchEffectiveRadiusKm(b *models.Branch) float64 {
	if len(b.ServiceZones) == 0 {
		return b.RadiusKm
	}
	max := 0.0
	for _, z := range b.ServiceZones {
		if z.RadiusKm > max {
			max = z.RadiusKm
		}
	}
	return max
}

// BranchDeliveryCharge returns the zone-based delivery fee for a point at
// distanceKm from the branch centre, and the index of the matched zone (-1
// when the point lies outside the outermost ring). For "per_km" zones the
// rate applies to the distance beyond the ring's inner edge (the previous
// zone's radius), so "2 km free, then ₹10/km" is modelled as a free 2 km
// zone followed by a per_km zone.
func BranchDeliveryCharge(b *models.Branch, distanceKm float64) (charge float64, zoneIndex int) {
	inner := 0.0
	for i, z := range b.ServiceZones {
		if distanceKm <= z.RadiusKm {
			switch z.ChargeType {
			case "flat":
				return math.Round(z.Charge*100) / 100, i
			case "per_km":
				extra := distanceKm - inner
				if extra < 0 {
					extra = 0
				}
				return math.Round(z.Charge*extra*100) / 100, i
			default:
				return 0, i
			}
		}
		inner = z.RadiusKm
	}
	return 0, -1
}

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
	r := BranchEffectiveRadiusKm(b)
	if r <= 0 {
		return false
	}
	return HaversineKm(lat, lng, b.CenterLat, b.CenterLng) <= r
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
// from the checked point (nil when matched by named area, not coordinates)
// and the zone-based delivery charge that applies at that distance.
type BranchMatch struct {
	Branch         *models.Branch `json:"branch"`
	DistanceKm     *float64       `json:"distance_km,omitempty"`
	DeliveryCharge *float64       `json:"delivery_charge,omitempty"`
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
		r := BranchEffectiveRadiusKm(b)
		if r <= 0 {
			continue
		}
		if d := HaversineKm(lat, lng, b.CenterLat, b.CenterLng); d <= r {
			dist := d
			m := BranchMatch{Branch: b, DistanceKm: &dist}
			if len(b.ServiceZones) > 0 {
				if charge, zi := BranchDeliveryCharge(b, d); zi >= 0 {
					m.DeliveryCharge = &charge
				}
			}
			out = append(out, m)
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
		`SELECT EXISTS(SELECT 1 FROM orders o WHERE o.id=$1 AND o.tenant_id=$2
			AND (o.branch_id=$3 OR EXISTS(SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND oi.branch_id=$3)))`,
		orderID, tenantID, branchID).Scan(&ok)
	return ok, err
}

// ProductVisibleInBranch reports whether a product is sellable at the given
// branch — store-wide products (branch_id NULL) plus products assigned to it.
func (s *Store) ProductVisibleInBranch(ctx context.Context, tenantID, productID, branchID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM products WHERE id=$1 AND tenant_id=$2 AND (branch_id IS NULL OR branch_id=$3))`,
		productID, tenantID, branchID).Scan(&ok)
	return ok, err
}

// ProductManagedByBranch reports whether a product is owned by the given
// branch — branch-bound staff may only mutate branch-owned products, not
// store-wide ones (which are managed at the store level).
func (s *Store) ProductManagedByBranch(ctx context.Context, tenantID, productID, branchID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM products WHERE id=$1 AND tenant_id=$2 AND branch_id=$3)`,
		productID, tenantID, branchID).Scan(&ok)
	return ok, err
}

// BranchBlockedProducts returns the names of products (from the given IDs)
// that are exclusive to a different branch and therefore cannot be fulfilled
// by branchID. Store-wide products (branch_id NULL) never block.
func (s *Store) BranchBlockedProducts(ctx context.Context, tenantID, branchID uuid.UUID, productIDs []uuid.UUID) ([]string, error) {
	if len(productIDs) == 0 {
		return nil, nil
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT name FROM products WHERE tenant_id=$1 AND id = ANY($2) AND branch_id IS NOT NULL AND branch_id <> $3`,
		tenantID, productIDs, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		names = append(names, n)
	}
	return names, nil
}

// CustomerInBranch reports whether a user has at least one order fulfilled
// by the given branch — used to gate branch-scoped staff from other
// branches' customer records.
func (s *Store) CustomerInBranch(ctx context.Context, tenantID, userID, branchID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM orders WHERE user_id=$1 AND tenant_id=$2 AND branch_id=$3)`,
		userID, tenantID, branchID).Scan(&ok)
	return ok, err
}

// ReturnInBranch reports whether a return belongs to an order fulfilled by
// the given branch.
func (s *Store) ReturnInBranch(ctx context.Context, tenantID, returnID, branchID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM order_returns r JOIN orders o ON o.id=r.order_id
		 WHERE r.id=$1 AND r.tenant_id=$2 AND o.branch_id=$3)`,
		returnID, tenantID, branchID).Scan(&ok)
	return ok, err
}

// PaymentTxnInBranch reports whether a payment transaction belongs to an
// order fulfilled by the given branch. Transactions without an order
// (e.g. wallet top-ups) are never branch-scoped.
func (s *Store) PaymentTxnInBranch(ctx context.Context, tenantID, txnID, branchID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM payment_transactions pt JOIN orders o ON o.id=pt.order_id
		 WHERE pt.id=$1 AND pt.tenant_id=$2 AND o.branch_id=$3)`,
		txnID, tenantID, branchID).Scan(&ok)
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

// ---------------- Stock-aware fulfillment ----------------

// branchCanFulfill reports whether the branch's effective stock covers every
// cart item. Effective stock = branch_stock row when present, otherwise the
// shared product/variant stock. Items without inventory tracking always pass.
func (s *Store) branchCanFulfill(ctx context.Context, branchID uuid.UUID, items []models.CartItem) bool {
	for _, it := range items {
		var eff int
		var tracked bool
		err := s.Pool.QueryRow(ctx,
			`SELECT COALESCE(bs.stock, COALESCE(v.stock, p.stock)), COALESCE(p.track_inventory, TRUE)
			 FROM products p
			 LEFT JOIN variants v ON v.id = $3
			 LEFT JOIN branch_stock bs ON bs.branch_id=$1 AND bs.product_id=p.id AND bs.variant_id IS NOT DISTINCT FROM $3
			 WHERE p.id=$2`, branchID, it.ProductID, it.VariantID).Scan(&eff, &tracked)
		if err != nil {
			return false
		}
		if tracked && eff < it.Quantity {
			return false
		}
	}
	return true
}

// ResolveFulfillmentBranch picks the nearest covering branch that can fulfil
// every item (stock-aware). Returns (nil, nil) when no branch covers the
// location at all, and (nil, ErrNoBranchStock) when branches cover it but
// none has enough stock — the caller maps each to a different message.
var ErrNoBranchStock = fmt.Errorf("no serviceable branch can fulfil all items in your cart")

func (s *Store) ResolveFulfillmentBranch(ctx context.Context, tenantID uuid.UUID, lat, lng *float64, area string, items []models.CartItem) (*models.Branch, error) {
	var matches []BranchMatch
	var err error
	if lat != nil && lng != nil {
		matches, err = s.ServiceableBranches(ctx, tenantID, *lat, *lng)
		if err != nil {
			return nil, err
		}
	}
	if len(matches) == 0 && area != "" {
		matches, err = s.BranchesCoveringArea(ctx, tenantID, area)
		if err != nil {
			return nil, err
		}
	}
	if len(matches) == 0 {
		return nil, nil
	}
	for _, m := range matches {
		if s.branchCanFulfill(ctx, m.Branch.ID, items) {
			return m.Branch, nil
		}
	}
	return nil, ErrNoBranchStock
}

// ---------------- Order handoffs ----------------

const handoffCols = `h.id, h.tenant_id, h.order_id, h.from_branch_id, COALESCE(fb.name,''), h.to_branch_id, COALESCE(tb.name,''),
	h.item_ids, h.status, h.note, h.created_by, h.responded_by, h.responded_at, h.created_at`

func scanHandoffs(rows pgx.Rows) ([]models.OrderHandoff, error) {
	defer rows.Close()
	out := []models.OrderHandoff{}
	for rows.Next() {
		var ho models.OrderHandoff
		var itemIDs []byte
		if err := rows.Scan(&ho.ID, &ho.TenantID, &ho.OrderID, &ho.FromBranchID, &ho.FromBranch,
			&ho.ToBranchID, &ho.ToBranch, &itemIDs, &ho.Status, &ho.Note,
			&ho.CreatedBy, &ho.RespondedBy, &ho.RespondedAt, &ho.CreatedAt); err != nil {
			return nil, err
		}
		if len(itemIDs) > 0 {
			_ = json.Unmarshal(itemIDs, &ho.ItemIDs)
		}
		out = append(out, ho)
	}
	return out, nil
}

// CreateOrderHandoff records a pending handoff request for an order.
// Empty itemIDs means the whole order moves on acceptance.
func (s *Store) CreateOrderHandoff(ctx context.Context, ho *models.OrderHandoff) error {
	ib, _ := json.Marshal(ho.ItemIDs)
	return s.Pool.QueryRow(ctx,
		`INSERT INTO order_handoffs (tenant_id, order_id, from_branch_id, to_branch_id, item_ids, note, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
		ho.TenantID, ho.OrderID, ho.FromBranchID, ho.ToBranchID, ib, ho.Note, ho.CreatedBy).
		Scan(&ho.ID, &ho.CreatedAt)
}

func (s *Store) ListOrderHandoffs(ctx context.Context, tenantID, orderID uuid.UUID) ([]models.OrderHandoff, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+handoffCols+` FROM order_handoffs h
		 LEFT JOIN branches fb ON fb.id=h.from_branch_id
		 LEFT JOIN branches tb ON tb.id=h.to_branch_id
		 WHERE h.order_id=$1 AND h.tenant_id=$2 ORDER BY h.created_at DESC`, orderID, tenantID)
	if err != nil {
		return nil, err
	}
	return scanHandoffs(rows)
}

// ListIncomingHandoffs returns pending handoffs addressed to a branch —
// for the receiving branch's "accept or reject" queue.
func (s *Store) ListIncomingHandoffs(ctx context.Context, tenantID, branchID uuid.UUID) ([]models.OrderHandoff, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+handoffCols+` FROM order_handoffs h
		 LEFT JOIN branches fb ON fb.id=h.from_branch_id
		 LEFT JOIN branches tb ON tb.id=h.to_branch_id
		 WHERE h.to_branch_id=$2 AND h.tenant_id=$1 AND h.status='pending'
		 ORDER BY h.created_at ASC`, tenantID, branchID)
	if err != nil {
		return nil, err
	}
	return scanHandoffs(rows)
}

func (s *Store) GetOrderHandoff(ctx context.Context, tenantID, id uuid.UUID) (*models.OrderHandoff, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+handoffCols+` FROM order_handoffs h
		 LEFT JOIN branches fb ON fb.id=h.from_branch_id
		 LEFT JOIN branches tb ON tb.id=h.to_branch_id
		 WHERE h.id=$1 AND h.tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	hs, err := scanHandoffs(rows)
	if err != nil || len(hs) == 0 {
		return nil, err
	}
	return &hs[0], nil
}

// RespondToHandoff transitions a pending handoff to accepted/rejected/cancelled.
// On acceptance: whole-order handoffs move orders.branch_id; item handoffs set
// order_items.branch_id on the listed lines.
func (s *Store) RespondToHandoff(ctx context.Context, ho *models.OrderHandoff, status, actor string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx,
		`UPDATE order_handoffs SET status=$3, responded_by=$4, responded_at=NOW()
		 WHERE id=$1 AND tenant_id=$2 AND status='pending'`, ho.ID, ho.TenantID, actor)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return sql.ErrNoRows
	}
	if status == "accepted" {
		if len(ho.ItemIDs) == 0 {
			if _, err := tx.Exec(ctx, `UPDATE orders SET branch_id=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
				ho.OrderID, ho.TenantID, ho.ToBranchID); err != nil {
				return err
			}
		} else {
			if _, err := tx.Exec(ctx, `UPDATE order_items SET branch_id=$3 WHERE order_id=$1 AND id = ANY($2)`,
				ho.OrderID, ho.ItemIDs, ho.ToBranchID); err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}

// PendingHandoffToBranch reports whether the order has a pending handoff
// addressed to the given branch — used to let the receiving branch view the
// order before accepting.
func (s *Store) PendingHandoffToBranch(ctx context.Context, tenantID, orderID, branchID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM order_handoffs WHERE order_id=$1 AND tenant_id=$2 AND to_branch_id=$3 AND status='pending')`,
		orderID, tenantID, branchID).Scan(&ok)
	return ok, err
}

// ListPendingHandoffs returns all pending handoffs for the store (admin view).
func (s *Store) ListPendingHandoffs(ctx context.Context, tenantID uuid.UUID) ([]models.OrderHandoff, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+handoffCols+` FROM order_handoffs h
		 LEFT JOIN branches fb ON fb.id=h.from_branch_id
		 LEFT JOIN branches tb ON tb.id=h.to_branch_id
		 WHERE h.tenant_id=$1 AND h.status='pending' ORDER BY h.created_at ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	return scanHandoffs(rows)
}
