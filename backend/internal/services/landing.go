package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Storefront homepage designs, selectable under Backoffice → Developer.
const (
	LandingVariantClassic = "classic"
	LandingVariantMinimal = "minimal"
)

// LandingVariants lists every selectable homepage design, in display order.
var LandingVariants = []string{LandingVariantClassic, LandingVariantMinimal}

// ErrInvalidLandingVariant is returned for an unknown variant code.
var ErrInvalidLandingVariant = errors.New("invalid landing variant")

// IsValidLandingVariant reports whether v is a known homepage design.
func IsValidLandingVariant(v string) bool {
	for _, k := range LandingVariants {
		if k == v {
			return true
		}
	}
	return false
}

// GetLandingVariant returns the store's homepage design, defaulting to classic
// when settings have not been created yet.
func (s *Store) GetLandingVariant(ctx context.Context, tenantID uuid.UUID) (string, error) {
	var v string
	err := s.Pool.QueryRow(ctx,
		`SELECT landing_variant FROM tenant_settings WHERE tenant_id=$1`, tenantID).Scan(&v)
	if errors.Is(err, pgx.ErrNoRows) {
		return LandingVariantClassic, nil
	}
	return v, err
}

// SetLandingVariant updates only the homepage design, leaving every other
// store setting untouched.
func (s *Store) SetLandingVariant(ctx context.Context, tenantID uuid.UUID, variant string) error {
	if !IsValidLandingVariant(variant) {
		return ErrInvalidLandingVariant
	}
	tag, err := s.Pool.Exec(ctx,
		`UPDATE tenant_settings SET landing_variant=$2 WHERE tenant_id=$1`, tenantID, variant)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
