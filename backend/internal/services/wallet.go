package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
)

var (
	ErrWalletNotFound      = errors.New("wallet not found")
	ErrInsufficientBalance = errors.New("insufficient wallet balance")
	ErrInvalidAmount       = errors.New("invalid amount")
)

// GetOrCreateWallet returns the customer's wallet for the given tenant, creating it on first access.
func (s *Store) GetOrCreateWallet(ctx context.Context, tenantID, userID uuid.UUID) (*models.CustomerWallet, error) {
	w := &models.CustomerWallet{}
	// ON CONFLICT DO UPDATE with a no-op update ensures a row is always returned
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO customer_wallets (tenant_id, user_id)
		 VALUES ($1, $2)
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET updated_at = customer_wallets.updated_at
		 RETURNING id, tenant_id, user_id, balance, currency_code, created_at, updated_at`,
		tenantID, userID).Scan(&w.ID, &w.TenantID, &w.UserID, &w.Balance, &w.CurrencyCode, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return w, nil
}

// GetWallet fetches an existing wallet without creating one.
func (s *Store) GetWallet(ctx context.Context, tenantID, userID uuid.UUID) (*models.CustomerWallet, error) {
	w := &models.CustomerWallet{}
	err := s.Pool.QueryRow(ctx,
		`SELECT id, tenant_id, user_id, balance, currency_code, created_at, updated_at
		 FROM customer_wallets WHERE tenant_id=$1 AND user_id=$2`,
		tenantID, userID).Scan(&w.ID, &w.TenantID, &w.UserID, &w.Balance, &w.CurrencyCode, &w.CreatedAt, &w.UpdatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrWalletNotFound
	}
	if err != nil {
		return nil, err
	}
	return w, nil
}

// CreditWallet atomically increases the wallet balance and records a credit transaction.
// source: "topup", "refund", "admin_adjustment"
// paymentTxnID / orderID are optional references.
func (s *Store) CreditWallet(ctx context.Context, tenantID, userID uuid.UUID, amount float64, source, description, reference string, paymentTxnID, orderID *uuid.UUID) (*models.WalletTransaction, error) {
	if amount <= 0 {
		return nil, ErrInvalidAmount
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var w models.CustomerWallet
	err = tx.QueryRow(ctx,
		`SELECT id, tenant_id, user_id, balance, currency_code FROM customer_wallets
		 WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,
		tenantID, userID).Scan(&w.ID, &w.TenantID, &w.UserID, &w.Balance, &w.CurrencyCode)
	if err == pgx.ErrNoRows {
		return nil, ErrWalletNotFound
	}
	if err != nil {
		return nil, err
	}

	newBalance := w.Balance + amount
	wt := &models.WalletTransaction{
		TenantID:     tenantID,
		WalletID:     w.ID,
		UserID:       userID,
		OrderID:      orderID,
		PaymentTxnID: paymentTxnID,
		Type:         "credit",
		Source:       source,
		Amount:       amount,
		BalanceAfter: newBalance,
		CurrencyCode: w.CurrencyCode,
		Description:  description,
		Reference:    reference,
	}

	_, err = tx.Exec(ctx,
		`UPDATE customer_wallets SET balance=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		w.ID, tenantID, newBalance)
	if err != nil {
		return nil, err
	}

	err = tx.QueryRow(ctx,
		`INSERT INTO wallet_transactions (tenant_id, wallet_id, user_id, order_id, payment_txn_id, type, source, amount, balance_after, currency_code, description, reference)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id, created_at`,
		wt.TenantID, wt.WalletID, wt.UserID, wt.OrderID, wt.PaymentTxnID, wt.Type, wt.Source, wt.Amount, wt.BalanceAfter, wt.CurrencyCode, wt.Description, wt.Reference,
	).Scan(&wt.ID, &wt.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return wt, nil
}

// DebitWallet atomically decreases the wallet balance and records a debit transaction.
// source: "purchase", "admin_adjustment"
// orderID is set for purchase debits.
func (s *Store) DebitWallet(ctx context.Context, tenantID, userID uuid.UUID, amount float64, source, description, reference string, orderID *uuid.UUID) (*models.WalletTransaction, error) {
	if amount <= 0 {
		return nil, ErrInvalidAmount
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var w models.CustomerWallet
	err = tx.QueryRow(ctx,
		`SELECT id, tenant_id, user_id, balance, currency_code FROM customer_wallets
		 WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,
		tenantID, userID).Scan(&w.ID, &w.TenantID, &w.UserID, &w.Balance, &w.CurrencyCode)
	if err == pgx.ErrNoRows {
		return nil, ErrWalletNotFound
	}
	if err != nil {
		return nil, err
	}

	if w.Balance < amount {
		return nil, ErrInsufficientBalance
	}

	newBalance := w.Balance - amount
	wt := &models.WalletTransaction{
		TenantID:     tenantID,
		WalletID:     w.ID,
		UserID:       userID,
		OrderID:      orderID,
		Type:         "debit",
		Source:       source,
		Amount:       amount,
		BalanceAfter: newBalance,
		CurrencyCode: w.CurrencyCode,
		Description:  description,
		Reference:    reference,
	}

	_, err = tx.Exec(ctx,
		`UPDATE customer_wallets SET balance=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		w.ID, tenantID, newBalance)
	if err != nil {
		return nil, err
	}

	err = tx.QueryRow(ctx,
		`INSERT INTO wallet_transactions (tenant_id, wallet_id, user_id, order_id, type, source, amount, balance_after, currency_code, description, reference)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id, created_at`,
		wt.TenantID, wt.WalletID, wt.UserID, wt.OrderID, wt.Type, wt.Source, wt.Amount, wt.BalanceAfter, wt.CurrencyCode, wt.Description, wt.Reference,
	).Scan(&wt.ID, &wt.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return wt, nil
}

// DebitWalletForOrder is a convenience wrapper that debits the wallet for a purchase.
// It returns the wallet transaction or ErrInsufficientBalance.
func (s *Store) DebitWalletForOrder(ctx context.Context, tenantID, userID uuid.UUID, amount float64, orderID uuid.UUID, currency string) (*models.WalletTransaction, error) {
	desc := fmt.Sprintf("Payment for order %s", orderID.String()[:8])
	return s.DebitWallet(ctx, tenantID, userID, amount, "purchase", desc, orderID.String(), &orderID)
}

// SetWalletTransactionOrder links a wallet transaction to an order after the order is created.
// Used for purchase debits where the order didn't exist when the wallet was debited.
func (s *Store) SetWalletTransactionOrder(ctx context.Context, walletTxnID, orderID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx,
		`UPDATE wallet_transactions SET order_id=$2 WHERE id=$1`,
		walletTxnID, orderID)
	return err
}

// ListWalletTransactions returns paginated wallet transactions for a user.
func (s *Store) ListWalletTransactions(ctx context.Context, tenantID, userID uuid.UUID, limit, offset int) ([]models.WalletTransaction, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var total int
	err := s.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM wallet_transactions WHERE tenant_id=$1 AND user_id=$2`,
		tenantID, userID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, wallet_id, user_id, order_id, payment_txn_id, type, source, amount, balance_after, currency_code, description, reference, created_at
		 FROM wallet_transactions
		 WHERE tenant_id=$1 AND user_id=$2
		 ORDER BY created_at DESC
		 LIMIT $3 OFFSET $4`,
		tenantID, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var txns []models.WalletTransaction
	for rows.Next() {
		var wt models.WalletTransaction
		if err := rows.Scan(&wt.ID, &wt.TenantID, &wt.WalletID, &wt.UserID, &wt.OrderID, &wt.PaymentTxnID, &wt.Type, &wt.Source, &wt.Amount, &wt.BalanceAfter, &wt.CurrencyCode, &wt.Description, &wt.Reference, &wt.CreatedAt); err != nil {
			return nil, 0, err
		}
		txns = append(txns, wt)
	}
	return txns, total, nil
}

// ListAllWalletTransactions returns paginated wallet transactions across all users in a tenant (admin view).
// WalletTxnFilter holds optional filters for listing wallet transactions.
type WalletTxnFilter struct {
	Type   string
	Source string
	Search string
	Dr     DateRangeFilter
}

func (s *Store) ListAllWalletTransactions(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.WalletTransaction, int, error) {
	return s.ListAllWalletTransactionsFiltered(ctx, tenantID, WalletTxnFilter{}, limit, offset)
}

func (s *Store) ListAllWalletTransactionsFiltered(ctx context.Context, tenantID uuid.UUID, f WalletTxnFilter, limit, offset int) ([]models.WalletTransaction, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	where := "WHERE wt.tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if f.Type != "" {
		where += fmt.Sprintf(" AND wt.type=$%d", argIdx)
		args = append(args, f.Type)
		argIdx++
	}
	if f.Source != "" {
		where += fmt.Sprintf(" AND wt.source=$%d", argIdx)
		args = append(args, f.Source)
		argIdx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (COALESCE(wt.description,'') ILIKE $%d OR wt.reference ILIKE $%d OR wt.id::text ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}
	drClause, args, argIdx := dateRangeClause("wt.created_at", f.Dr, args, argIdx)
	where += drClause

	var total int
	err := s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM wallet_transactions wt %s`, where), args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := s.Pool.Query(ctx,
		fmt.Sprintf(`SELECT wt.id, wt.tenant_id, wt.wallet_id, wt.user_id, wt.order_id, wt.payment_txn_id, wt.type, wt.source, wt.amount, wt.balance_after, wt.currency_code, wt.description, wt.reference, wt.created_at
		 FROM wallet_transactions wt
		 %s
		 ORDER BY wt.created_at DESC
		 LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1),
		append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var txns []models.WalletTransaction
	for rows.Next() {
		var wt models.WalletTransaction
		if err := rows.Scan(&wt.ID, &wt.TenantID, &wt.WalletID, &wt.UserID, &wt.OrderID, &wt.PaymentTxnID, &wt.Type, &wt.Source, &wt.Amount, &wt.BalanceAfter, &wt.CurrencyCode, &wt.Description, &wt.Reference, &wt.CreatedAt); err != nil {
			return nil, 0, err
		}
		txns = append(txns, wt)
	}
	return txns, total, nil
}

// WalletStats returns aggregate wallet stats for a tenant (admin dashboard).
func (s *Store) WalletStats(ctx context.Context, tenantID uuid.UUID) (map[string]interface{}, error) {
	var walletCount int
	var totalBalance float64
	var totalTopups float64
	var totalPurchases float64

	err := s.Pool.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM customer_wallets WHERE tenant_id=$1),
			COALESCE((SELECT SUM(balance) FROM customer_wallets WHERE tenant_id=$1), 0),
			COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE tenant_id=$1 AND type='credit' AND source='topup'), 0),
			COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE tenant_id=$1 AND type='debit' AND source='purchase'), 0)
		`, tenantID).Scan(&walletCount, &totalBalance, &totalTopups, &totalPurchases)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"wallet_count":     walletCount,
		"total_balance":    totalBalance,
		"total_topups":     totalTopups,
		"total_purchases":   totalPurchases,
	}, nil
}
