package services

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// IdempotencyRecord represents a stored idempotency key with its cached response.
type IdempotencyRecord struct {
	ID             uuid.UUID
	TenantID       *uuid.UUID
	UserID         *uuid.UUID
	Key            string
	Scope          string
	RequestHash    string
	Status         string // "processing" | "completed"
	ResponseStatus int
	ResponseBody   json.RawMessage
	CreatedAt      time.Time
	CompletedAt    *time.Time
}

// ErrIdempotencyConflict is returned when a key is already being processed.
var ErrIdempotencyConflict = errors.New("idempotency key is already being processed")

// ErrIdempotencyKeyMismatch is returned when the same key is reused with a different request body.
var ErrIdempotencyKeyMismatch = errors.New("idempotency key was used with a different request body")

// IdempotencyStore provides DB operations for idempotency key tracking.
type IdempotencyStore struct {
	pool *pgxpool.Pool
}

func NewIdempotencyStore(pool *pgxpool.Pool) *IdempotencyStore {
	return &IdempotencyStore{pool: pool}
}

// BeginProcessing attempts to insert a "processing" record for the given key.
// If a record already exists:
//   - completed → returns the cached record so the caller can replay the response
//   - processing → returns ErrIdempotencyConflict
//   - same key, different request hash → returns ErrIdempotencyKeyMismatch
func (s *IdempotencyStore) BeginProcessing(ctx context.Context, tenantID *uuid.UUID, userID *uuid.UUID, key, scope, requestHash string) (*IdempotencyRecord, error) {
	// First check if a record already exists
	existing, err := s.getRecord(ctx, tenantID, scope, key)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if existing != nil {
		if existing.RequestHash != "" && requestHash != "" && existing.RequestHash != requestHash {
			return nil, ErrIdempotencyKeyMismatch
		}
		if existing.Status == "completed" {
			return existing, nil
		}
		return nil, ErrIdempotencyConflict
	}

	// Insert a new "processing" record
	rec := &IdempotencyRecord{
		TenantID:    tenantID,
		UserID:      userID,
		Key:         key,
		Scope:       scope,
		RequestHash: requestHash,
		Status:      "processing",
	}
	row := s.pool.QueryRow(ctx, `
		INSERT INTO idempotency_keys (tenant_id, user_id, key, scope, request_hash, status)
		VALUES ($1, $2, $3, $4, $5, 'processing')
		RETURNING id, created_at`,
		tenantID, userID, key, scope, requestHash)
	if err := row.Scan(&rec.ID, &rec.CreatedAt); err != nil {
		// Race: another request inserted first. Re-read to get the winner's state.
		existing, err2 := s.getRecord(ctx, tenantID, scope, key)
		if err2 == nil && existing != nil {
			if existing.Status == "completed" {
				return existing, nil
			}
			return nil, ErrIdempotencyConflict
		}
		return nil, err
	}
	return rec, nil
}

// CompleteProcessing stores the response and marks the record as completed.
func (s *IdempotencyStore) CompleteProcessing(ctx context.Context, id uuid.UUID, responseStatus int, responseBody json.RawMessage) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE idempotency_keys
		SET status = 'completed', response_status = $2, response_body = $3, completed_at = NOW()
		WHERE id = $1`,
		id, responseStatus, responseBody)
	return err
}

// AbortProcessing deletes a "processing" record so the client can retry.
// Used when the handler returns a 5xx error.
func (s *IdempotencyStore) AbortProcessing(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM idempotency_keys WHERE id = $1 AND status = 'processing'`, id)
	return err
}

// CleanupOld removes idempotency records older than the given duration.
func (s *IdempotencyStore) CleanupOld(ctx context.Context, age time.Duration) (int64, error) {
	ct, err := s.pool.Exec(ctx, `DELETE FROM idempotency_keys WHERE created_at < NOW() - $1::interval`, age.String())
	if err != nil {
		return 0, err
	}
	return ct.RowsAffected(), nil
}

func (s *IdempotencyStore) getRecord(ctx context.Context, tenantID *uuid.UUID, scope, key string) (*IdempotencyRecord, error) {
	rec := &IdempotencyRecord{}
	var respStatus *int
	var respBody []byte
	var completedAt *time.Time
	var userID *uuid.UUID

	err := s.pool.QueryRow(ctx, `
		SELECT id, tenant_id, user_id, key, scope, request_hash, status, response_status, response_body, created_at, completed_at
		FROM idempotency_keys
		WHERE tenant_id IS NOT DISTINCT FROM $1 AND scope = $2 AND key = $3`,
		tenantID, scope, key).Scan(
		&rec.ID, &rec.TenantID, &userID, &rec.Key, &rec.Scope, &rec.RequestHash, &rec.Status,
		&respStatus, &respBody, &rec.CreatedAt, &completedAt)
	if err != nil {
		return nil, err
	}
	if userID != nil {
		rec.UserID = userID
	}
	if respStatus != nil {
		rec.ResponseStatus = *respStatus
	}
	if respBody != nil {
		rec.ResponseBody = json.RawMessage(respBody)
	}
	if completedAt != nil {
		rec.CompletedAt = completedAt
	}
	return rec, nil
}
