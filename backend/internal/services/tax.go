package services

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/trucommerce/backend/internal/models"
)

// ---------------- Tax Classes ----------------

func (s *Store) ListTaxClasses(ctx context.Context, tenantID uuid.UUID) ([]models.TaxClass, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, name, COALESCE(description,''), is_default, is_active, created_at, updated_at
		 FROM tax_classes WHERE tenant_id=$1 ORDER BY is_default DESC, name ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TaxClass
	for rows.Next() {
		var tc models.TaxClass
		if err := rows.Scan(&tc.ID, &tc.TenantID, &tc.Name, &tc.Description, &tc.IsDefault, &tc.IsActive, &tc.CreatedAt, &tc.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, tc)
	}
	return out, nil
}

func (s *Store) GetTaxClass(ctx context.Context, tenantID, classID uuid.UUID) (*models.TaxClass, error) {
	var tc models.TaxClass
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, COALESCE(description,''), is_default, is_active, created_at, updated_at
		 FROM tax_classes WHERE id=$1 AND tenant_id=$2`, classID, tenantID).
		Scan(&tc.ID, &tc.TenantID, &tc.Name, &tc.Description, &tc.IsDefault, &tc.IsActive, &tc.CreatedAt, &tc.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &tc, nil
}

func (s *Store) CreateTaxClass(ctx context.Context, tc *models.TaxClass) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO tax_classes (tenant_id, name, description, is_default, is_active)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, created_at, updated_at`,
		tc.TenantID, tc.Name, tc.Description, tc.IsDefault, tc.IsActive,
	).Scan(&tc.ID, &tc.CreatedAt, &tc.UpdatedAt)
}

func (s *Store) UpdateTaxClass(ctx context.Context, tc *models.TaxClass) error {
	// If setting as default, unset other defaults for this tenant
	if tc.IsDefault {
		_, _ = s.Pool.Exec(ctx, `UPDATE tax_classes SET is_default=FALSE WHERE tenant_id=$1 AND id != $2`, tc.TenantID, tc.ID)
	}
	_, err := s.Pool.Exec(ctx,
		`UPDATE tax_classes SET name=$3, description=$4, is_default=$5, is_active=$6, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		tc.ID, tc.TenantID, tc.Name, tc.Description, tc.IsDefault, tc.IsActive)
	return err
}

func (s *Store) DeleteTaxClass(ctx context.Context, tenantID, classID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM tax_classes WHERE id=$1 AND tenant_id=$2`, classID, tenantID)
	return err
}

// ---------------- Tax Zones ----------------

func (s *Store) ListTaxZones(ctx context.Context, tenantID uuid.UUID) ([]models.TaxZone, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, name, COALESCE(country_code,''), COALESCE(state_code,''),
		        COALESCE(city,''), COALESCE(postal_code_pattern,''), is_active, created_at, updated_at
		 FROM tax_zones WHERE tenant_id=$1 ORDER BY name ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TaxZone
	for rows.Next() {
		var tz models.TaxZone
		if err := rows.Scan(&tz.ID, &tz.TenantID, &tz.Name, &tz.CountryCode, &tz.StateCode, &tz.City, &tz.PostalCodePattern, &tz.IsActive, &tz.CreatedAt, &tz.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, tz)
	}
	return out, nil
}

func (s *Store) CreateTaxZone(ctx context.Context, tz *models.TaxZone) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO tax_zones (tenant_id, name, country_code, state_code, city, postal_code_pattern, is_active)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, created_at, updated_at`,
		tz.TenantID, tz.Name, nullableStr(tz.CountryCode), nullableStr(tz.StateCode), nullableStr(tz.City), nullableStr(tz.PostalCodePattern), tz.IsActive,
	).Scan(&tz.ID, &tz.CreatedAt, &tz.UpdatedAt)
}

func (s *Store) UpdateTaxZone(ctx context.Context, tz *models.TaxZone) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE tax_zones SET name=$3, country_code=$4, state_code=$5, city=$6, postal_code_pattern=$7, is_active=$8, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		tz.ID, tz.TenantID, tz.Name, nullableStr(tz.CountryCode), nullableStr(tz.StateCode), nullableStr(tz.City), nullableStr(tz.PostalCodePattern), tz.IsActive)
	return err
}

func (s *Store) DeleteTaxZone(ctx context.Context, tenantID, zoneID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM tax_zones WHERE id=$1 AND tenant_id=$2`, zoneID, tenantID)
	return err
}

// ---------------- Tax Rates ----------------

func (s *Store) ListTaxRates(ctx context.Context, tenantID uuid.UUID) ([]models.TaxRate, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT tr.id, tr.tenant_id, tr.tax_class_id, tr.tax_zone_id, tr.name, tr.rate, tr.compound,
		        tr.priority, tr.is_active, tr.effective_from, tr.effective_to, tr.created_at, tr.updated_at,
		        tc.name, tz.name
		 FROM tax_rates tr
		 JOIN tax_classes tc ON tc.id = tr.tax_class_id
		 JOIN tax_zones tz ON tz.id = tr.tax_zone_id
		 WHERE tr.tenant_id=$1
		 ORDER BY tr.priority ASC, tr.name ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TaxRate
	for rows.Next() {
		var tr models.TaxRate
		if err := rows.Scan(&tr.ID, &tr.TenantID, &tr.TaxClassID, &tr.TaxZoneID, &tr.Name, &tr.Rate, &tr.Compound,
			&tr.Priority, &tr.IsActive, &tr.EffectiveFrom, &tr.EffectiveTo, &tr.CreatedAt, &tr.UpdatedAt,
			&tr.TaxClassName, &tr.TaxZoneName); err != nil {
			return nil, err
		}
		out = append(out, tr)
	}
	return out, nil
}

func (s *Store) CreateTaxRate(ctx context.Context, tr *models.TaxRate) error {
	return s.Pool.QueryRow(ctx,
		`INSERT INTO tax_rates (tenant_id, tax_class_id, tax_zone_id, name, rate, compound, priority, is_active, effective_from, effective_to)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id, created_at, updated_at`,
		tr.TenantID, tr.TaxClassID, tr.TaxZoneID, tr.Name, tr.Rate, tr.Compound, tr.Priority, tr.IsActive, tr.EffectiveFrom, tr.EffectiveTo,
	).Scan(&tr.ID, &tr.CreatedAt, &tr.UpdatedAt)
}

func (s *Store) UpdateTaxRate(ctx context.Context, tr *models.TaxRate) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE tax_rates SET tax_class_id=$3, tax_zone_id=$4, name=$5, rate=$6, compound=$7, priority=$8,
		        is_active=$9, effective_from=$10, effective_to=$11, updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2`,
		tr.ID, tr.TenantID, tr.TaxClassID, tr.TaxZoneID, tr.Name, tr.Rate, tr.Compound, tr.Priority, tr.IsActive, tr.EffectiveFrom, tr.EffectiveTo)
	return err
}

func (s *Store) DeleteTaxRate(ctx context.Context, tenantID, rateID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM tax_rates WHERE id=$1 AND tenant_id=$2`, rateID, tenantID)
	return err
}

// ---------------- Tax Calculation ----------------

// CalculateTax computes tax for a set of line items based on the shipping address.
// It matches the address to tax zones, finds applicable tax rates per product tax class,
// and returns a detailed breakdown.
func (s *Store) CalculateTax(ctx context.Context, tenantID uuid.UUID, req *models.TaxCalculationRequest, settings *models.TenantSettings) (*models.TaxCalculationResult, error) {
	result := &models.TaxCalculationResult{
		TaxInclusive: settings.TaxInclusive,
		Breakdown:    []models.TaxBreakdownLine{},
	}

	if len(req.Items) == 0 {
		return result, nil
	}

	// Find matching tax zones for the shipping address
	zones, err := s.findMatchingTaxZones(ctx, tenantID, req.ShippingAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to find tax zones: %w", err)
	}
	if len(zones) == 0 {
		// No matching zones = no tax
		return result, nil
	}

	// Get the default tax class ID from settings (fallback for products without a tax class)
	defaultClassID := settings.DefaultTaxClassID

	// Group items by tax class
	type classGroup struct {
		classID  uuid.UUID
		amount   float64
	}
	groups := map[uuid.UUID]*classGroup{}

	// Apply discount proportionally across items
	discountPerItem := 0.0
	itemsTotal := 0.0
	for _, item := range req.Items {
		itemsTotal += item.LineTotal
	}
	if req.DiscountTotal > 0 && req.DiscountTotal < itemsTotal {
		discountPerItem = req.DiscountTotal / float64(len(req.Items))
	}

	for _, item := range req.Items {
		classID := defaultClassID
		if item.TaxClassID != nil {
			classID = item.TaxClassID
		}
		if classID == nil {
			continue // No tax class = tax exempt
		}
		amount := item.LineTotal - discountPerItem
		if amount < 0 {
			amount = 0
		}
		if g, ok := groups[*classID]; ok {
			g.amount += amount
		} else {
			groups[*classID] = &classGroup{classID: *classID, amount: amount}
		}
	}

	// Add shipping to taxable amount if tax_shipping is enabled
	shippingTaxable := 0.0
	if settings.TaxShipping && req.ShippingTotal > 0 {
		shippingTaxable = req.ShippingTotal
	}

	// For each group, find applicable rates in matching zones
	var allRates []models.TaxRate
	for _, zone := range zones {
		for classID, group := range groups {
			rates, err := s.getRatesForClassAndZone(ctx, tenantID, classID, zone.ID)
			if err != nil {
				return nil, err
			}
			for _, rate := range rates {
				taxableAmount := group.amount
				if shippingTaxable > 0 {
					taxableAmount += shippingTaxable
				}
				if taxableAmount <= 0 {
					continue
				}
				allRates = append(allRates, rate)
				result.Breakdown = append(result.Breakdown, models.TaxBreakdownLine{
					TaxRateID:     rate.ID,
					TaxClassName:  rate.TaxClassName,
					TaxZoneName:   zone.Name,
					RateName:      rate.Name,
					Rate:          rate.Rate,
					TaxableAmount: taxableAmount,
					TaxAmount:     taxableAmount * rate.Rate / 100,
					Compound:      rate.Compound,
				})
			}
		}
	}

	// Sort breakdown by priority (non-compound first, then compound)
	sort.Slice(result.Breakdown, func(i, j int) bool {
		if result.Breakdown[i].Compound != result.Breakdown[j].Compound {
			return !result.Breakdown[i].Compound
		}
		return result.Breakdown[i].Rate < result.Breakdown[j].Rate
	})

	// Calculate total tax (handle compound rates)
	totalTax := 0.0
	for _, line := range result.Breakdown {
		if line.Compound {
			// Compound tax is calculated on (taxable amount + previous taxes)
			totalTax += (line.TaxableAmount + totalTax) * line.Rate / 100
		} else {
			totalTax += line.TaxAmount
		}
	}

	result.TaxTotal = totalTax
	return result, nil
}

// findMatchingTaxZones finds all tax zones that match the given shipping address.
// More specific zones (country + state + city) take priority over less specific ones.
// If specific zones match, only those are returned. If no specific zones match,
// zones with NULL country (catch-all) are returned.
func (s *Store) findMatchingTaxZones(ctx context.Context, tenantID uuid.UUID, addr models.AddressInput) ([]models.TaxZone, error) {
	country := addr.Country
	state := addr.State
	city := addr.City

	// First try to find specific zones matching country + state (+ city)
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, name, COALESCE(country_code,''), COALESCE(state_code,''),
		        COALESCE(city,''), COALESCE(postal_code_pattern,''), is_active, created_at, updated_at
		 FROM tax_zones
		 WHERE tenant_id=$1 AND is_active=TRUE
		   AND (country_code IS NULL OR country_code = $2)
		   AND (state_code IS NULL OR state_code = $3)
		   AND (city IS NULL OR city = $4)
		 ORDER BY
		   CASE WHEN country_code IS NOT NULL THEN 0 ELSE 1 END,
		   CASE WHEN state_code IS NOT NULL THEN 0 ELSE 1 END,
		   CASE WHEN city IS NOT NULL THEN 0 ELSE 1 END`,
		tenantID, country, state, city)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var allMatches []models.TaxZone
	var specificMatches []models.TaxZone
	var catchAllMatches []models.TaxZone

	for rows.Next() {
		var tz models.TaxZone
		if err := rows.Scan(&tz.ID, &tz.TenantID, &tz.Name, &tz.CountryCode, &tz.StateCode, &tz.City, &tz.PostalCodePattern, &tz.IsActive, &tz.CreatedAt, &tz.UpdatedAt); err != nil {
			return nil, err
		}
		if tz.CountryCode != "" || tz.StateCode != "" || tz.City != "" {
			specificMatches = append(specificMatches, tz)
		} else {
			catchAllMatches = append(catchAllMatches, tz)
		}
		allMatches = append(allMatches, tz)
	}

	// Prefer specific matches; fall back to catch-all
	if len(specificMatches) > 0 {
		return specificMatches, nil
	}
	if len(catchAllMatches) > 0 {
		return catchAllMatches, nil
	}
	return allMatches, nil
}

// getRatesForClassAndZone returns active tax rates for a given tax class and zone.
func (s *Store) getRatesForClassAndZone(ctx context.Context, tenantID, classID, zoneID uuid.UUID) ([]models.TaxRate, error) {
	now := time.Now()
	rows, err := s.Pool.Query(ctx,
		`SELECT tr.id, tr.tenant_id, tr.tax_class_id, tr.tax_zone_id, tr.name, tr.rate, tr.compound,
		        tr.priority, tr.is_active, tr.effective_from, tr.effective_to, tr.created_at, tr.updated_at,
		        tc.name, tz.name
		 FROM tax_rates tr
		 JOIN tax_classes tc ON tc.id = tr.tax_class_id
		 JOIN tax_zones tz ON tz.id = tr.tax_zone_id
		 WHERE tr.tenant_id=$1 AND tr.tax_class_id=$2 AND tr.tax_zone_id=$3
		   AND tr.is_active=TRUE
		   AND (tr.effective_from IS NULL OR tr.effective_from <= $4)
		   AND (tr.effective_to IS NULL OR tr.effective_to >= $4)
		 ORDER BY tr.priority ASC`,
		tenantID, classID, zoneID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TaxRate
	for rows.Next() {
		var tr models.TaxRate
		if err := rows.Scan(&tr.ID, &tr.TenantID, &tr.TaxClassID, &tr.TaxZoneID, &tr.Name, &tr.Rate, &tr.Compound,
			&tr.Priority, &tr.IsActive, &tr.EffectiveFrom, &tr.EffectiveTo, &tr.CreatedAt, &tr.UpdatedAt,
			&tr.TaxClassName, &tr.TaxZoneName); err != nil {
			return nil, err
		}
		out = append(out, tr)
	}
	return out, nil
}

// Helper to convert empty string to nil for nullable columns
func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// GetDefaultTaxClass returns the default tax class for a tenant.
func (s *Store) GetDefaultTaxClass(ctx context.Context, tenantID uuid.UUID) (*models.TaxClass, error) {
	var tc models.TaxClass
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, COALESCE(description,''), is_default, is_active, created_at, updated_at
		 FROM tax_classes WHERE tenant_id=$1 AND is_default=TRUE LIMIT 1`, tenantID).
		Scan(&tc.ID, &tc.TenantID, &tc.Name, &tc.Description, &tc.IsDefault, &tc.IsActive, &tc.CreatedAt, &tc.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &tc, nil
}
