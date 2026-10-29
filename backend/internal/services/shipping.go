package services

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
)

// ---------------- Shipping Methods ----------------

func (s *Store) ListShippingMethods(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingMethod, error) {
	items, _, err := s.ListShippingMethodsPaged(ctx, tenantID, 0, 0)
	return items, err
}

// ListShippingMethodsPaged returns a page of shipping methods plus the total
// count. limit <= 0 returns all rows.
func (s *Store) ListShippingMethodsPaged(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.ShippingMethod, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM shipping_methods WHERE tenant_id=$1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}
	q, args := pageClause(
		`SELECT id, tenant_id, name, code, COALESCE(description,''), base_rate, weight_rate, currency_code,
		        min_days, max_days, free_shipping_threshold, is_active, sort_order, created_at, updated_at
		 FROM shipping_methods WHERE tenant_id=$1 ORDER BY sort_order ASC, name ASC`,
		[]interface{}{tenantID}, limit, offset)
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []models.ShippingMethod
	for rows.Next() {
		var sm models.ShippingMethod
		if err := rows.Scan(&sm.ID, &sm.TenantID, &sm.Name, &sm.Code, &sm.Description, &sm.BaseRate, &sm.WeightRate,
			&sm.CurrencyCode, &sm.MinDays, &sm.MaxDays, &sm.FreeShippingThreshold, &sm.IsActive, &sm.SortOrder,
			&sm.CreatedAt, &sm.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, sm)
	}
	return out, total, nil
}

func (s *Store) ListActiveShippingMethods(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingMethod, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, name, code, COALESCE(description,''), base_rate, weight_rate, currency_code,
		        min_days, max_days, free_shipping_threshold, is_active, sort_order, created_at, updated_at
		 FROM shipping_methods WHERE tenant_id=$1 AND is_active=TRUE ORDER BY sort_order ASC, name ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ShippingMethod
	for rows.Next() {
		var sm models.ShippingMethod
		if err := rows.Scan(&sm.ID, &sm.TenantID, &sm.Name, &sm.Code, &sm.Description, &sm.BaseRate, &sm.WeightRate,
			&sm.CurrencyCode, &sm.MinDays, &sm.MaxDays, &sm.FreeShippingThreshold, &sm.IsActive, &sm.SortOrder,
			&sm.CreatedAt, &sm.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, sm)
	}
	return out, nil
}

func (s *Store) GetShippingMethod(ctx context.Context, tenantID, methodID uuid.UUID) (*models.ShippingMethod, error) {
	var sm models.ShippingMethod
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, code, COALESCE(description,''), base_rate, weight_rate, currency_code,
		        min_days, max_days, free_shipping_threshold, is_active, sort_order, created_at, updated_at
		 FROM shipping_methods WHERE id=$1 AND tenant_id=$2`, methodID, tenantID).
		Scan(&sm.ID, &sm.TenantID, &sm.Name, &sm.Code, &sm.Description, &sm.BaseRate, &sm.WeightRate,
			&sm.CurrencyCode, &sm.MinDays, &sm.MaxDays, &sm.FreeShippingThreshold, &sm.IsActive, &sm.SortOrder,
			&sm.CreatedAt, &sm.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sm, nil
}

func (s *Store) GetShippingMethodByCode(ctx context.Context, tenantID uuid.UUID, code string) (*models.ShippingMethod, error) {
	var sm models.ShippingMethod
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, code, COALESCE(description,''), base_rate, weight_rate, currency_code,
		        min_days, max_days, free_shipping_threshold, is_active, sort_order, created_at, updated_at
		 FROM shipping_methods WHERE code=$1 AND tenant_id=$2`, code, tenantID).
		Scan(&sm.ID, &sm.TenantID, &sm.Name, &sm.Code, &sm.Description, &sm.BaseRate, &sm.WeightRate,
			&sm.CurrencyCode, &sm.MinDays, &sm.MaxDays, &sm.FreeShippingThreshold, &sm.IsActive, &sm.SortOrder,
			&sm.CreatedAt, &sm.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sm, nil
}

func (s *Store) CreateShippingMethod(ctx context.Context, sm *models.ShippingMethod) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO shipping_methods (tenant_id, name, code, description, base_rate, weight_rate, currency_code,
		          min_days, max_days, free_shipping_threshold, is_active, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id, created_at, updated_at`,
		sm.TenantID, sm.Name, sm.Code, sm.Description, sm.BaseRate, sm.WeightRate, sm.CurrencyCode,
		sm.MinDays, sm.MaxDays, sm.FreeShippingThreshold, sm.IsActive, sm.SortOrder).
		Scan(&sm.ID, &sm.CreatedAt, &sm.UpdatedAt)
}

func (s *Store) UpdateShippingMethod(ctx context.Context, sm *models.ShippingMethod) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE shipping_methods SET name=$1, code=$2, description=$3, base_rate=$4, weight_rate=$5, currency_code=$6,
		          min_days=$7, max_days=$8, free_shipping_threshold=$9, is_active=$10, sort_order=$11
		 WHERE id=$12 AND tenant_id=$13`,
		sm.Name, sm.Code, sm.Description, sm.BaseRate, sm.WeightRate, sm.CurrencyCode,
		sm.MinDays, sm.MaxDays, sm.FreeShippingThreshold, sm.IsActive, sm.SortOrder,
		sm.ID, sm.TenantID)
	return err
}

func (s *Store) DeleteShippingMethod(ctx context.Context, tenantID, methodID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM shipping_methods WHERE id=$1 AND tenant_id=$2`, methodID, tenantID)
	return err
}

// ---------------- Shipping Zones ----------------

func (s *Store) ListShippingZones(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingZone, error) {
	items, _, err := s.ListShippingZonesPaged(ctx, tenantID, 0, 0)
	return items, err
}

// ListShippingZonesPaged returns a page of shipping zones plus the total
// count. limit <= 0 returns all rows.
func (s *Store) ListShippingZonesPaged(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.ShippingZone, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM shipping_zones WHERE tenant_id=$1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}
	q, args := pageClause(
		`SELECT id, tenant_id, name, COALESCE(country_code,''), COALESCE(state_code,''),
		        COALESCE(city,''), COALESCE(postal_code_pattern,''), is_active, created_at, updated_at
		 FROM shipping_zones WHERE tenant_id=$1 ORDER BY name ASC`,
		[]interface{}{tenantID}, limit, offset)
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []models.ShippingZone
	for rows.Next() {
		var sz models.ShippingZone
		if err := rows.Scan(&sz.ID, &sz.TenantID, &sz.Name, &sz.CountryCode, &sz.StateCode,
			&sz.City, &sz.PostalCodePattern, &sz.IsActive, &sz.CreatedAt, &sz.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, sz)
	}
	return out, total, nil
}

func (s *Store) CreateShippingZone(ctx context.Context, sz *models.ShippingZone) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO shipping_zones (tenant_id, name, country_code, state_code, city, postal_code_pattern, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, created_at, updated_at`,
		sz.TenantID, sz.Name, nullableStr(sz.CountryCode), nullableStr(sz.StateCode),
		nullableStr(sz.City), nullableStr(sz.PostalCodePattern), sz.IsActive).
		Scan(&sz.ID, &sz.CreatedAt, &sz.UpdatedAt)
}

func (s *Store) UpdateShippingZone(ctx context.Context, sz *models.ShippingZone) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE shipping_zones SET name=$1, country_code=$2, state_code=$3, city=$4, postal_code_pattern=$5, is_active=$6
		 WHERE id=$7 AND tenant_id=$8`,
		sz.Name, nullableStr(sz.CountryCode), nullableStr(sz.StateCode),
		nullableStr(sz.City), nullableStr(sz.PostalCodePattern), sz.IsActive,
		sz.ID, sz.TenantID)
	return err
}

func (s *Store) DeleteShippingZone(ctx context.Context, tenantID, zoneID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM shipping_zones WHERE id=$1 AND tenant_id=$2`, zoneID, tenantID)
	return err
}

// ---------------- Shipping Rates ----------------

func (s *Store) ListShippingRates(ctx context.Context, tenantID uuid.UUID) ([]models.ShippingRate, error) {
	items, _, err := s.ListShippingRatesPaged(ctx, tenantID, 0, 0)
	return items, err
}

// ListShippingRatesPaged returns a page of shipping rates plus the total
// count. limit <= 0 returns all rows.
func (s *Store) ListShippingRatesPaged(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.ShippingRate, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM shipping_rates WHERE tenant_id=$1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}
	q, args := pageClause(
		`SELECT sr.id, sr.tenant_id, sr.shipping_method_id, sr.shipping_zone_id, sr.rate, sr.is_active,
		        sr.created_at, sr.updated_at,
		        COALESCE(sm.name,''), COALESCE(sz.name,'')
		 FROM shipping_rates sr
		 LEFT JOIN shipping_methods sm ON sm.id = sr.shipping_method_id
		 LEFT JOIN shipping_zones sz ON sz.id = sr.shipping_zone_id
		 WHERE sr.tenant_id=$1 ORDER BY sm.name ASC, sz.name ASC`,
		[]interface{}{tenantID}, limit, offset)
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []models.ShippingRate
	for rows.Next() {
		var sr models.ShippingRate
		if err := rows.Scan(&sr.ID, &sr.TenantID, &sr.ShippingMethodID, &sr.ShippingZoneID, &sr.Rate,
			&sr.IsActive, &sr.CreatedAt, &sr.UpdatedAt, &sr.ShippingMethodName, &sr.ShippingZoneName); err != nil {
			return nil, 0, err
		}
		out = append(out, sr)
	}
	return out, total, nil
}

func (s *Store) CreateShippingRate(ctx context.Context, sr *models.ShippingRate) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO shipping_rates (tenant_id, shipping_method_id, shipping_zone_id, rate, is_active)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, created_at, updated_at`,
		sr.TenantID, sr.ShippingMethodID, sr.ShippingZoneID, sr.Rate, sr.IsActive).
		Scan(&sr.ID, &sr.CreatedAt, &sr.UpdatedAt)
}

func (s *Store) UpdateShippingRate(ctx context.Context, sr *models.ShippingRate) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE shipping_rates SET shipping_method_id=$1, shipping_zone_id=$2, rate=$3, is_active=$4
		 WHERE id=$5 AND tenant_id=$6`,
		sr.ShippingMethodID, sr.ShippingZoneID, sr.Rate, sr.IsActive, sr.ID, sr.TenantID)
	return err
}

func (s *Store) DeleteShippingRate(ctx context.Context, tenantID, rateID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM shipping_rates WHERE id=$1 AND tenant_id=$2`, rateID, tenantID)
	return err
}

// ---------------- Shipping Calculation ----------------

// CalculateShipping returns the available shipping options for a given subtotal and shipping address.
// It resolves zone-specific rates and applies free shipping thresholds.
// When request.Items is provided, it considers product-level shipping settings:
//   - If no items require shipping (all digital), returns no options.
//   - If all shippable items have free_shipping=true, all methods are free.
//   - Weight-based rate: base_rate + weight_rate * total_weight (kg) of shippable items.
// When request.Items is provided, PerItemOptions is also populated, giving each
// shippable cart item its own list of shipping options (split-shipment support).
func (s *Store) CalculateShipping(ctx context.Context, tenantID uuid.UUID, req *models.ShippingCalculationRequest) (*models.ShippingCalculationResult, error) {
	// Determine whether any items require shipping and compute total weight.
	hasShippable := true
	allFreeShipping := false
	totalWeight := 0.0
	if len(req.Items) > 0 {
		hasShippable = false
		allFreeShipping = true
		for _, it := range req.Items {
			if !it.RequiresShipping {
				continue
			}
			hasShippable = true
			if !it.FreeShipping {
				allFreeShipping = false
			}
			totalWeight += it.Weight * float64(it.Quantity)
		}
	}

	// If no items require shipping, return no options (digital-only cart).
	if !hasShippable {
		return &models.ShippingCalculationResult{Options: []models.ShippingOption{}}, nil
	}

	// Get all active shipping methods
	methods, err := s.ListActiveShippingMethods(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list shipping methods: %w", err)
	}

	// Find matching shipping zones for the address
	matchingZones, err := s.findMatchingShippingZones(ctx, tenantID, req.ShippingAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to match shipping zones: %w", err)
	}

	options := s.buildShippingOptions(methods, matchingZones, req.Subtotal, totalWeight, allFreeShipping, tenantID)

	result := &models.ShippingCalculationResult{Options: options}

	// Build per-item options for split-shipment selection.
	if len(req.Items) > 0 {
		perItem := make([]models.ItemShippingOptions, 0, len(req.Items))
		for _, it := range req.Items {
			if !it.RequiresShipping {
				continue
			}
			itemWeight := it.Weight * float64(it.Quantity)
			itemAllFree := it.FreeShipping
			itemOpts := s.buildShippingOptions(methods, matchingZones, it.LineTotal, itemWeight, itemAllFree, tenantID)
			perItem = append(perItem, models.ItemShippingOptions{
				ProductID: it.ProductID,
				Options:   itemOpts,
			})
		}
		result.PerItemOptions = perItem
	}

	return result, nil
}

// buildShippingOptions constructs shipping options for the given methods, zones, subtotal, and weight.
// This is shared between order-level and per-item calculations.
func (s *Store) buildShippingOptions(methods []models.ShippingMethod, matchingZones []models.ShippingZone, subtotal, totalWeight float64, allFreeShipping bool, tenantID uuid.UUID) []models.ShippingOption {
	options := make([]models.ShippingOption, 0, len(methods))
	for _, m := range methods {
		// Determine the rate: zone-specific rate > base_rate
		rate := m.BaseRate
		zoneSpecificRate := s.findZoneSpecificRate(context.Background(), tenantID, m.ID, matchingZones)

		if zoneSpecificRate >= 0 {
			rate = zoneSpecificRate
		}

		// Apply weight-based surcharge (per kg on top of base/zone rate)
		if m.WeightRate > 0 && totalWeight > 0 {
			rate += m.WeightRate * totalWeight
		}

		// Apply free shipping: per-product override or subtotal threshold
		isFree := false
		if allFreeShipping {
			rate = 0
			isFree = true
		} else if m.FreeShippingThreshold != nil && subtotal >= *m.FreeShippingThreshold {
			rate = 0
			isFree = true
		}

		// Build estimated delivery string
		estimatedDelivery := ""
		if m.MinDays != nil && m.MaxDays != nil {
			if *m.MinDays == *m.MaxDays {
				estimatedDelivery = fmt.Sprintf("%d business day%s", *m.MinDays, pluralize(*m.MinDays))
			} else {
				estimatedDelivery = fmt.Sprintf("%d-%d business days", *m.MinDays, *m.MaxDays)
			}
		}

		options = append(options, models.ShippingOption{
			MethodID:          m.ID,
			Code:              m.Code,
			Name:              m.Name,
			Description:       m.Description,
			Rate:              rate,
			CurrencyCode:      m.CurrencyCode,
			MinDays:           m.MinDays,
			MaxDays:           m.MaxDays,
			IsFree:            isFree,
			EstimatedDelivery: estimatedDelivery,
		})
	}
	return options
}

// findZoneSpecificRate looks for a zone-specific rate for the given method and matching zones.
// Returns -1 if no zone-specific rate is found.
func (s *Store) findZoneSpecificRate(ctx context.Context, tenantID, methodID uuid.UUID, zones []models.ShippingZone) float64 {
	if len(zones) == 0 {
		return -1
	}
	// Build zone ID list
	zoneIDs := make([]uuid.UUID, 0, len(zones))
	for _, z := range zones {
		zoneIDs = append(zoneIDs, z.ID)
	}

	// Query for an active rate matching this method + any of the matching zones
	// We use ANY() to match against the array of zone IDs
	row := s.Pool.QueryRow(ctx,
		`SELECT rate FROM shipping_rates
		 WHERE tenant_id=$1 AND shipping_method_id=$2 AND shipping_zone_id = ANY($3) AND is_active=TRUE
		 LIMIT 1`,
		tenantID, methodID, zoneIDs)

	var rate float64
	err := row.Scan(&rate)
	if err != nil {
		return -1
	}
	return rate
}

// findMatchingShippingZones finds all shipping zones that match the given address.
// More specific zones (country+state) are returned first, catch-all zones last.
func (s *Store) findMatchingShippingZones(ctx context.Context, tenantID uuid.UUID, addr models.AddressInput) ([]models.ShippingZone, error) {
	// Normalize the address values
	country := strings.ToUpper(strings.TrimSpace(addr.Country))
	state := strings.ToUpper(strings.TrimSpace(addr.State))
	city := strings.TrimSpace(addr.City)
	postal := strings.TrimSpace(addr.PostalCode)

	// Query all active zones and filter in Go (simpler than complex SQL with NULL matching)
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, name, COALESCE(country_code,''), COALESCE(state_code,''),
		        COALESCE(city,''), COALESCE(postal_code_pattern,''), is_active, created_at, updated_at
		 FROM shipping_zones WHERE tenant_id=$1 AND is_active=TRUE`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var all []models.ShippingZone
	for rows.Next() {
		var sz models.ShippingZone
		if err := rows.Scan(&sz.ID, &sz.TenantID, &sz.Name, &sz.CountryCode, &sz.StateCode,
			&sz.City, &sz.PostalCodePattern, &sz.IsActive, &sz.CreatedAt, &sz.UpdatedAt); err != nil {
			return nil, err
		}
		all = append(all, sz)
	}

	// Filter to matching zones
	var matched []models.ShippingZone
	for _, z := range all {
		if !zoneMatches(z, country, state, city, postal) {
			continue
		}
		matched = append(matched, z)
	}

	// Sort by specificity (most specific first)
	sortShippingZonesBySpecificity(matched)

	return matched, nil
}

// zoneMatches checks if a shipping zone matches the given address.
func zoneMatches(z models.ShippingZone, country, state, city, postal string) bool {
	// Country must match if specified
	if z.CountryCode != "" && z.CountryCode != country {
		return false
	}
	// State must match if specified
	if z.StateCode != "" && z.StateCode != state {
		return false
	}
	// City must match if specified (case-insensitive)
	if z.City != "" && !strings.EqualFold(z.City, city) {
		return false
	}
	// Postal code pattern must match if specified (SQL LIKE pattern)
	if z.PostalCodePattern != "" && postal != "" {
		if !likeMatch(postal, z.PostalCodePattern) {
			return false
		}
	}
	return true
}

// likeMatch implements SQL LIKE pattern matching (% and _ wildcards)
func likeMatch(s, pattern string) bool {
	// Convert LIKE pattern to regex
	var result strings.Builder
	result.WriteString("^")
	for _, ch := range pattern {
		switch ch {
		case '%':
			result.WriteString(".*")
		case '_':
			result.WriteString(".")
		default:
			// Escape regex special chars
			if strings.ContainsRune(`.+*?()|[]{}^$\`, ch) {
				result.WriteByte('\\')
			}
			result.WriteRune(ch)
		}
	}
	result.WriteString("$")
	matched, err := regexp.MatchString(result.String(), s)
	if err != nil {
		return false
	}
	return matched
}

// sortShippingZonesBySpecificity sorts zones so that more specific zones come first.
func sortShippingZonesBySpecificity(zones []models.ShippingZone) {
	for i := 0; i < len(zones); i++ {
		for j := i + 1; j < len(zones); j++ {
			if zoneSpecificity(zones[j]) > zoneSpecificity(zones[i]) {
				zones[i], zones[j] = zones[j], zones[i]
			}
		}
	}
}

func zoneSpecificity(z models.ShippingZone) int {
	score := 0
	if z.CountryCode != "" {
		score += 1
	}
	if z.StateCode != "" {
		score += 2
	}
	if z.City != "" {
		score += 4
	}
	if z.PostalCodePattern != "" {
		score += 8
	}
	return score
}

func pluralize(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

// ResolveShippingRate calculates the shipping total for a given method code, subtotal, and address.
// Used by checkout to determine the actual shipping cost.
// When items is provided, it considers product-level shipping settings (digital-only, free shipping, weight).
func (s *Store) ResolveShippingRate(ctx context.Context, tenantID uuid.UUID, methodCode string, subtotal float64, addr models.AddressInput, items []models.ShippingCalculationItem) (float64, error) {
	// If items are provided and none require shipping, shipping is free.
	if len(items) > 0 {
		hasShippable := false
		allFreeShipping := true
		totalWeight := 0.0
		for _, it := range items {
			if !it.RequiresShipping {
				continue
			}
			hasShippable = true
			if !it.FreeShipping {
				allFreeShipping = false
			}
			totalWeight += it.Weight * float64(it.Quantity)
		}
		if !hasShippable {
			return 0, nil
		}
		if allFreeShipping {
			return 0, nil
		}

		method, err := s.GetShippingMethodByCode(ctx, tenantID, methodCode)
		if err != nil {
			return 0, fmt.Errorf("shipping method '%s' not found: %w", methodCode, err)
		}

		// Check free shipping threshold
		if method.FreeShippingThreshold != nil && subtotal >= *method.FreeShippingThreshold {
			return 0, nil
		}

		// Find matching zones
		matchingZones, err := s.findMatchingShippingZones(ctx, tenantID, addr)
		if err != nil {
			return method.BaseRate, nil
		}

		// Look for zone-specific rate
		zoneRate := s.findZoneSpecificRate(ctx, tenantID, method.ID, matchingZones)
		rate := method.BaseRate
		if zoneRate >= 0 {
			rate = zoneRate
		}

		// Apply weight-based surcharge
		if method.WeightRate > 0 && totalWeight > 0 {
			rate += method.WeightRate * totalWeight
		}

		return rate, nil
	}

	// Legacy path: no items provided, use subtotal + address only.
	method, err := s.GetShippingMethodByCode(ctx, tenantID, methodCode)
	if err != nil {
		return 0, fmt.Errorf("shipping method '%s' not found: %w", methodCode, err)
	}

	// Check free shipping threshold first
	if method.FreeShippingThreshold != nil && subtotal >= *method.FreeShippingThreshold {
		return 0, nil
	}

	// Find matching zones
	matchingZones, err := s.findMatchingShippingZones(ctx, tenantID, addr)
	if err != nil {
		return method.BaseRate, nil // fall back to base rate
	}

	// Look for zone-specific rate
	zoneRate := s.findZoneSpecificRate(ctx, tenantID, method.ID, matchingZones)
	if zoneRate >= 0 {
		return zoneRate, nil
	}

	return method.BaseRate, nil
}

// ResolveShippingRateForItem calculates the shipping cost for a single cart item
// with the given method code. Used for per-item (split-shipment) shipping selection.
// Returns 0 for digital items or items with free_shipping=true.
func (s *Store) ResolveShippingRateForItem(ctx context.Context, tenantID uuid.UUID, methodCode string, item models.ShippingCalculationItem) (float64, error) {
	if !item.RequiresShipping {
		return 0, nil
	}
	if item.FreeShipping {
		return 0, nil
	}
	method, err := s.GetShippingMethodByCode(ctx, tenantID, methodCode)
	if err != nil {
		return 0, fmt.Errorf("shipping method '%s' not found: %w", methodCode, err)
	}
	// Free shipping threshold is evaluated against the item line total.
	if method.FreeShippingThreshold != nil && item.LineTotal >= *method.FreeShippingThreshold {
		return 0, nil
	}
	rate := method.BaseRate
	// Zone-specific rate (address not available here; caller resolves zones separately if needed)
	// Apply weight-based surcharge for this item only.
	itemWeight := item.Weight * float64(item.Quantity)
	if method.WeightRate > 0 && itemWeight > 0 {
		rate += method.WeightRate * itemWeight
	}
	return rate, nil
}
