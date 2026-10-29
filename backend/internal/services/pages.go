package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/trucommerce/backend/internal/models"
)

// ListStorePages returns all pages for a tenant.
func (s *Store) ListStorePages(ctx context.Context, tenantID uuid.UUID) ([]models.StorePage, error) {
	items, _, err := s.ListStorePagesPaged(ctx, tenantID, 0, 0)
	return items, err
}

// ListStorePagesPaged returns a page of store pages plus the total count.
// limit <= 0 returns all rows.
func (s *Store) ListStorePagesPaged(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.StorePage, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM store_pages WHERE tenant_id=$1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}
	q, args := pageClause(`
		SELECT id, tenant_id, slug, title, page_type, status, blocks,
		       meta_title, meta_description, is_system, is_customized,
		       to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		FROM store_pages
		WHERE tenant_id=$1
		ORDER BY
			CASE slug
				WHEN 'home' THEN 0
				WHEN 'about' THEN 1
				WHEN 'contact' THEN 2
				WHEN 'privacy-policy' THEN 3
				WHEN 'terms' THEN 4
				ELSE 5
			END,
			title`, []interface{}{tenantID}, limit, offset)
	rows, err := s.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items, err := scanStorePages(rows)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetStorePage returns a single page by ID.
func (s *Store) GetStorePage(ctx context.Context, tenantID, pageID uuid.UUID) (*models.StorePage, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, tenant_id, slug, title, page_type, status, blocks,
		       meta_title, meta_description, is_system, is_customized,
		       to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		FROM store_pages
		WHERE id=$1 AND tenant_id=$2`, pageID, tenantID)
	return scanStorePage(row)
}

// GetStorePageBySlug returns a single published page by slug (for storefront rendering).
func (s *Store) GetStorePageBySlug(ctx context.Context, tenantID uuid.UUID, slug string) (*models.StorePage, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, tenant_id, slug, title, page_type, status, blocks,
		       meta_title, meta_description, is_system, is_customized,
		       to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
		FROM store_pages
		WHERE tenant_id=$1 AND slug=$2 AND status='published'`, tenantID, slug)
	return scanStorePage(row)
}

// CreateStorePage creates a new store page.
func (s *Store) CreateStorePage(ctx context.Context, p *models.StorePage) error {
	blocksJSON, err := json.Marshal(p.Blocks)
	if err != nil {
		return fmt.Errorf("failed to marshal blocks: %w", err)
	}
	now := time.Now()
	err = s.Pool.QueryRow(ctx, `
		INSERT INTO store_pages (tenant_id, slug, title, page_type, status, blocks, meta_title, meta_description, is_system, is_customized, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, $9, $9)
		RETURNING id, created_at, updated_at`,
		p.TenantID, p.Slug, p.Title, p.PageType, p.Status, blocksJSON, p.MetaTitle, p.MetaDescription, now).
		Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create store page: %w", err)
	}
	return nil
}

// UpdateStorePage updates a store page.
func (s *Store) UpdateStorePage(ctx context.Context, tenantID, pageID uuid.UUID, req *models.StorePageRequest) (*models.StorePage, error) {
	blocksJSON, err := json.Marshal(req.Blocks)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal blocks: %w", err)
	}
	tag, err := s.Pool.Exec(ctx, `
		UPDATE store_pages
		SET slug=$3, title=$4, page_type=$5, status=$6, blocks=$7, meta_title=$8, meta_description=$9, is_customized=true, updated_at=NOW()
		WHERE id=$1 AND tenant_id=$2`,
		pageID, tenantID, req.Slug, req.Title, req.PageType, req.Status, blocksJSON, req.MetaTitle, req.MetaDescription)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, pgx.ErrNoRows
	}
	return s.GetStorePage(ctx, tenantID, pageID)
}

// DeleteStorePage deletes a store page (system pages cannot be deleted).
func (s *Store) DeleteStorePage(ctx context.Context, tenantID, pageID uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `
		DELETE FROM store_pages
		WHERE id=$1 AND tenant_id=$2 AND is_system=false`, pageID, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("page not found or cannot be deleted (system page)")
	}
	return nil
}

// scanStorePage scans a single row into a StorePage.
func scanStorePage(row pgx.Row) (*models.StorePage, error) {
	var p models.StorePage
	var blocksJSON []byte
	var createdAtStr, updatedAtStr string
	err := row.Scan(
		&p.ID, &p.TenantID, &p.Slug, &p.Title, &p.PageType, &p.Status, &blocksJSON,
		&p.MetaTitle, &p.MetaDescription, &p.IsSystem, &p.IsCustomized,
		&createdAtStr, &updatedAtStr,
	)
	if err != nil {
		return nil, err
	}
	if blocksJSON != nil {
		_ = json.Unmarshal(blocksJSON, &p.Blocks)
	}
	p.CreatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", createdAtStr)
	p.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", updatedAtStr)
	return &p, nil
}

// scanStorePages scans multiple rows into a slice of StorePage.
func scanStorePages(rows pgx.Rows) ([]models.StorePage, error) {
	var pages []models.StorePage
	for rows.Next() {
		var p models.StorePage
		var blocksJSON []byte
		var createdAtStr, updatedAtStr string
		err := rows.Scan(
			&p.ID, &p.TenantID, &p.Slug, &p.Title, &p.PageType, &p.Status, &blocksJSON,
			&p.MetaTitle, &p.MetaDescription, &p.IsSystem, &p.IsCustomized,
			&createdAtStr, &updatedAtStr,
		)
		if err != nil {
			return nil, err
		}
		if blocksJSON != nil {
			_ = json.Unmarshal(blocksJSON, &p.Blocks)
		}
		p.CreatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", createdAtStr)
		p.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", updatedAtStr)
		pages = append(pages, p)
	}
	return pages, rows.Err()
}
