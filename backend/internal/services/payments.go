package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/trucommerce/backend/internal/models"
)

// ---------------- Payment Transactions ----------------

func (s *Store) ListPaymentTransactions(ctx context.Context, tenantID uuid.UUID, limit, offset int, status, gateway string) ([]models.PaymentTransaction, int, error) {
	return s.ListPaymentTransactionsFiltered(ctx, tenantID, PaymentTxnFilter{
		Status:  status,
		Gateway: gateway,
	}, limit, offset)
}

// PaymentTxnFilter holds optional filters for listing payment transactions.
type PaymentTxnFilter struct {
	Status  string
	Gateway string
	Type    string
	Search  string
	Dr      DateRangeFilter
}

func (s *Store) ListPaymentTransactionsFiltered(ctx context.Context, tenantID uuid.UUID, f PaymentTxnFilter, limit, offset int) ([]models.PaymentTransaction, int, error) {
	// Build query with optional filters
	where := "WHERE pt.tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if f.Status != "" {
		where += fmt.Sprintf(" AND pt.status=$%d", argIdx)
		args = append(args, f.Status)
		argIdx++
	}
	if f.Gateway != "" {
		where += fmt.Sprintf(" AND pt.gateway=$%d", argIdx)
		args = append(args, f.Gateway)
		argIdx++
	}
	if f.Type != "" {
		where += fmt.Sprintf(" AND pt.type=$%d", argIdx)
		args = append(args, f.Type)
		argIdx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (COALESCE(pt.gateway_txn_id,'') ILIKE $%d OR COALESCE(pt.customer_email,'') ILIKE $%d OR COALESCE(pt.customer_name,'') ILIKE $%d OR pt.id::text ILIKE $%d)", argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}
	drClause, args, argIdx := dateRangeClause("pt.created_at", f.Dr, args, argIdx)
	where += drClause

	// Count total
	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM payment_transactions pt %s", where)
	if err := s.Pool.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Fetch page
	query := fmt.Sprintf(`
		SELECT pt.id, pt.tenant_id, COALESCE(pt.order_id, '00000000-0000-0000-0000-000000000000'::uuid), pt.user_id, pt.gateway,
		       COALESCE(pt.gateway_txn_id,''), pt.type, pt.status, pt.amount,
		       pt.currency_code, pt.refunded_amount, COALESCE(pt.gateway_response,'{}'::jsonb),
		       COALESCE(pt.failure_reason,''), COALESCE(pt.customer_email,''),
		       COALESCE(pt.customer_name,''), pt.created_at, pt.updated_at,
		       COALESCE(o.status,''), COALESCE(o.grand_total, 0)
		FROM payment_transactions pt
		LEFT JOIN orders o ON o.id = pt.order_id
		%s
		ORDER BY pt.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]models.PaymentTransaction, 0)
	for rows.Next() {
		var pt models.PaymentTransaction
		var gatewayResponse []byte
		if err := rows.Scan(
			&pt.ID, &pt.TenantID, &pt.OrderID, &pt.UserID, &pt.Gateway,
			&pt.GatewayTxnID, &pt.Type, &pt.Status, &pt.Amount,
			&pt.CurrencyCode, &pt.RefundedAmount, &gatewayResponse,
			&pt.FailureReason, &pt.CustomerEmail, &pt.CustomerName,
			&pt.CreatedAt, &pt.UpdatedAt, &pt.OrderStatus, &pt.OrderGrandTotal,
		); err != nil {
			return nil, 0, err
		}
		if gatewayResponse != nil {
			_ = json.Unmarshal(gatewayResponse, &pt.GatewayResponse)
		}
		out = append(out, pt)
	}
	return out, total, nil
}

func (s *Store) GetPaymentTransaction(ctx context.Context, tenantID, txnID uuid.UUID) (*models.PaymentTransaction, error) {
	var pt models.PaymentTransaction
	var gatewayResponse []byte
	err := s.Pool.QueryRow(ctx,
		`SELECT pt.id, pt.tenant_id, COALESCE(pt.order_id, '00000000-0000-0000-0000-000000000000'::uuid), pt.user_id, pt.gateway,
		        COALESCE(pt.gateway_txn_id,''), pt.type, pt.status, pt.amount,
		        pt.currency_code, pt.refunded_amount, COALESCE(pt.gateway_response,'{}'::jsonb),
		        COALESCE(pt.failure_reason,''), COALESCE(pt.customer_email,''),
		        COALESCE(pt.customer_name,''), pt.created_at, pt.updated_at,
		        COALESCE(o.status,''), COALESCE(o.grand_total, 0)
		 FROM payment_transactions pt
		 LEFT JOIN orders o ON o.id = pt.order_id
		 WHERE pt.id=$1 AND pt.tenant_id=$2`, txnID, tenantID).
		Scan(
			&pt.ID, &pt.TenantID, &pt.OrderID, &pt.UserID, &pt.Gateway,
			&pt.GatewayTxnID, &pt.Type, &pt.Status, &pt.Amount,
			&pt.CurrencyCode, &pt.RefundedAmount, &gatewayResponse,
			&pt.FailureReason, &pt.CustomerEmail, &pt.CustomerName,
			&pt.CreatedAt, &pt.UpdatedAt, &pt.OrderStatus, &pt.OrderGrandTotal,
		)
	if err != nil {
		return nil, err
	}
	if gatewayResponse != nil {
		_ = json.Unmarshal(gatewayResponse, &pt.GatewayResponse)
	}
	return &pt, nil
}

func (s *Store) ListOrderPaymentTransactions(ctx context.Context, tenantID, orderID uuid.UUID) ([]models.PaymentTransaction, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id, gateway,
		        COALESCE(gateway_txn_id,''), type, status, amount,
		        currency_code, refunded_amount, COALESCE(gateway_response,'{}'::jsonb),
		        COALESCE(failure_reason,''), COALESCE(customer_email,''),
		        COALESCE(customer_name,''), created_at, updated_at
		 FROM payment_transactions
		 WHERE order_id=$1 AND tenant_id=$2
		 ORDER BY created_at ASC`, orderID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.PaymentTransaction, 0)
	for rows.Next() {
		var pt models.PaymentTransaction
		var gatewayResponse []byte
		if err := rows.Scan(
			&pt.ID, &pt.TenantID, &pt.OrderID, &pt.UserID, &pt.Gateway,
			&pt.GatewayTxnID, &pt.Type, &pt.Status, &pt.Amount,
			&pt.CurrencyCode, &pt.RefundedAmount, &gatewayResponse,
			&pt.FailureReason, &pt.CustomerEmail, &pt.CustomerName,
			&pt.CreatedAt, &pt.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if gatewayResponse != nil {
			_ = json.Unmarshal(gatewayResponse, &pt.GatewayResponse)
		}
		out = append(out, pt)
	}
	return out, nil
}

// RecordPaymentTransaction creates a new payment transaction record.
// Called during checkout after the gateway processes the payment.
func (s *Store) RecordPaymentTransaction(ctx context.Context, pt *models.PaymentTransaction) error {
	var gatewayResponseJSON []byte
	if pt.GatewayResponse != nil {
		gatewayResponseJSON, _ = json.Marshal(pt.GatewayResponse)
	}
	// Convert zero OrderID to NULL (wallet top-ups have no associated order)
	var orderID interface{}
	if pt.OrderID != (uuid.UUID{}) {
		orderID = pt.OrderID
	}
	return s.Pool.QueryRow(ctx,
		`INSERT INTO payment_transactions (tenant_id, order_id, user_id, gateway, gateway_txn_id,
		          type, status, amount, currency_code, gateway_response, failure_reason,
		          customer_email, customer_name)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING id, created_at, updated_at`,
		pt.TenantID, orderID, pt.UserID, pt.Gateway, pt.GatewayTxnID,
		pt.Type, pt.Status, pt.Amount, pt.CurrencyCode, gatewayResponseJSON,
		pt.FailureReason, pt.CustomerEmail, pt.CustomerName).
		Scan(&pt.ID, &pt.CreatedAt, &pt.UpdatedAt)
}

// RefundPaymentTransaction processes a refund for an existing payment transaction.
// In production, this would call the gateway's refund API. For now, it records the refund
// and updates the transaction and order status.
func (s *Store) RefundPaymentTransaction(ctx context.Context, tenantID, txnID uuid.UUID, req *models.RefundRequest) (*models.PaymentTransaction, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Get the original transaction
	var pt models.PaymentTransaction
	var gatewayResponse []byte
	err = tx.QueryRow(ctx,
		`SELECT id, tenant_id, COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid), gateway, COALESCE(gateway_txn_id,''), type, status,
		        amount, currency_code, refunded_amount, COALESCE(gateway_response,'{}'::jsonb),
		        COALESCE(customer_email,''), COALESCE(customer_name,'')
		 FROM payment_transactions WHERE id=$1 AND tenant_id=$2`, txnID, tenantID).
		Scan(&pt.ID, &pt.TenantID, &pt.OrderID, &pt.Gateway, &pt.GatewayTxnID, &pt.Type,
			&pt.Status, &pt.Amount, &pt.CurrencyCode, &pt.RefundedAmount, &gatewayResponse,
			&pt.CustomerEmail, &pt.CustomerName)
	if err != nil {
		return nil, fmt.Errorf("transaction not found: %w", err)
	}

	if pt.Status != "success" {
		return nil, fmt.Errorf("cannot refund a transaction with status '%s'", pt.Status)
	}

	// Determine refund amount
	refundAmount := req.Amount
	if refundAmount <= 0 || refundAmount > pt.Amount-pt.RefundedAmount {
		refundAmount = pt.Amount - pt.RefundedAmount // full refund of remaining
	}

	newRefundedTotal := pt.RefundedAmount + refundAmount
	newStatus := "partial_refund"
	if newRefundedTotal >= pt.Amount {
		newStatus = "refunded"
	}

	// Update the original transaction
	_, err = tx.Exec(ctx,
		`UPDATE payment_transactions SET refunded_amount=$1, status=$2 WHERE id=$3`,
		newRefundedTotal, newStatus, txnID)
	if err != nil {
		return nil, err
	}

	// Create a refund transaction record
	refundTxn := &models.PaymentTransaction{
		TenantID:      pt.TenantID,
		OrderID:       pt.OrderID,
		Gateway:       pt.Gateway,
		GatewayTxnID:  pt.GatewayTxnID,
		Type:          "refund",
		Status:        "success",
		Amount:        -refundAmount, // negative for refund
		CurrencyCode:  pt.CurrencyCode,
		CustomerEmail: pt.CustomerEmail,
		CustomerName:  pt.CustomerName,
		GatewayResponse: map[string]interface{}{
			"refund_reason": req.Reason,
			"original_txn":  txnID.String(),
		},
	}
	var refundResponseJSON []byte
	if refundTxn.GatewayResponse != nil {
		refundResponseJSON, _ = json.Marshal(refundTxn.GatewayResponse)
	}
	err = tx.QueryRow(ctx,
		`INSERT INTO payment_transactions (tenant_id, order_id, gateway, gateway_txn_id,
		          type, status, amount, currency_code, gateway_response,
		          customer_email, customer_name)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id, created_at, updated_at`,
		refundTxn.TenantID, refundTxn.OrderID, refundTxn.Gateway, refundTxn.GatewayTxnID,
		refundTxn.Type, refundTxn.Status, refundTxn.Amount, refundTxn.CurrencyCode,
		refundResponseJSON, refundTxn.CustomerEmail, refundTxn.CustomerName).
		Scan(&refundTxn.ID, &refundTxn.CreatedAt, &refundTxn.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Update order refunded_amount and status
	_, err = tx.Exec(ctx,
		`UPDATE orders SET refunded_amount = (
		     SELECT COALESCE(SUM(ABS(amount)),0) FROM payment_transactions
		     WHERE order_id=$1 AND type='refund' AND status='success'
		 ) WHERE id=$1`, pt.OrderID)
	if err != nil {
		return nil, err
	}

	// If fully refunded, update order status to 'refunded'
	if newStatus == "refunded" {
		_, err = tx.Exec(ctx, `UPDATE orders SET status='refunded' WHERE id=$1 AND tenant_id=$2`, pt.OrderID, tenantID)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	// Reload the updated original transaction
	updated, err := s.GetPaymentTransaction(ctx, tenantID, txnID)
	if err != nil {
		return refundTxn, nil
	}
	return updated, nil
}

// ---------------- Payment Gateway Configs ----------------

func (s *Store) ListPaymentGatewayConfigs(ctx context.Context, tenantID uuid.UUID) ([]models.PaymentGatewayConfig, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT id, tenant_id, gateway_code, display_name, is_enabled, is_test_mode,
		        sort_order, COALESCE(config,'{}'::jsonb), created_at, updated_at
		 FROM payment_gateway_configs WHERE tenant_id=$1 ORDER BY sort_order ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.PaymentGatewayConfig, 0)
	for rows.Next() {
		var pgc models.PaymentGatewayConfig
		var configBytes []byte
		if err := rows.Scan(&pgc.ID, &pgc.TenantID, &pgc.GatewayCode, &pgc.DisplayName,
			&pgc.IsEnabled, &pgc.IsTestMode, &pgc.SortOrder, &configBytes,
			&pgc.CreatedAt, &pgc.UpdatedAt); err != nil {
			return nil, err
		}
		if configBytes != nil {
			_ = json.Unmarshal(configBytes, &pgc.Config)
		}
		out = append(out, pgc)
	}
	return out, nil
}

func (s *Store) UpdatePaymentGatewayConfig(ctx context.Context, pgc *models.PaymentGatewayConfig) error {
	var configBytes []byte
	if pgc.Config != nil {
		configBytes, _ = json.Marshal(pgc.Config)
	} else {
		configBytes = []byte(`{}`)
	}
	_, err := s.Pool.Exec(ctx,
		`UPDATE payment_gateway_configs SET display_name=$1, is_enabled=$2, is_test_mode=$3,
		          sort_order=$4, config=$5
		 WHERE id=$6 AND tenant_id=$7`,
		pgc.DisplayName, pgc.IsEnabled, pgc.IsTestMode, pgc.SortOrder, configBytes,
		pgc.ID, pgc.TenantID)
	return err
}

// ---------------- Payment Stats ----------------

func (s *Store) PaymentStats(ctx context.Context, tenantID uuid.UUID, dr DateRangeFilter) (*models.PaymentStats, error) {
	stats := &models.PaymentStats{}

	// Build date-range clause for payment_transactions.created_at
	var drArgs []interface{}
	drIdx := 1
	drArgs = append(drArgs, tenantID)
	drIdx++
	drClause, drArgs, drIdx := dateRangeClause("pt.created_at", dr, drArgs, drIdx)

	// Total collected (successful captures)
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COALESCE(SUM(amount),0) FROM payment_transactions pt
		 WHERE pt.tenant_id=$1 AND pt.type='capture' AND pt.status='success'%s`, drClause),
		drArgs...).Scan(&stats.TotalCollected)

	// Total refunded
	refundArgs := make([]interface{}, len(drArgs))
	copy(refundArgs, drArgs)
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COALESCE(SUM(ABS(amount)),0) FROM payment_transactions pt
		 WHERE pt.tenant_id=$1 AND pt.type='refund' AND pt.status='success'%s`, drClause),
		refundArgs...).Scan(&stats.TotalRefunded)

	stats.NetRevenue = stats.TotalCollected - stats.TotalRefunded

	// Counts
	countArgs := make([]interface{}, len(drArgs))
	copy(countArgs, drArgs)
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM payment_transactions pt
		 WHERE pt.tenant_id=$1 AND pt.type='capture'%s`, drClause),
		countArgs...).Scan(&stats.TransactionCount)

	pendingArgs := make([]interface{}, len(drArgs))
	copy(pendingArgs, drArgs)
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM payment_transactions pt
		 WHERE pt.tenant_id=$1 AND pt.status='pending'%s`, drClause),
		pendingArgs...).Scan(&stats.PendingCount)

	failedArgs := make([]interface{}, len(drArgs))
	copy(failedArgs, drArgs)
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM payment_transactions pt
		 WHERE pt.tenant_id=$1 AND pt.status='failed'%s`, drClause),
		failedArgs...).Scan(&stats.FailedCount)

	// Refund count (always all-time for accuracy of refund totals)
	s.Pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM payment_transactions pt
		 WHERE pt.tenant_id=$1 AND pt.type='refund' AND pt.status='success'%s`, drClause),
		refundArgs...).Scan(&stats.RefundCount)

	// By gateway
	rows, err := s.Pool.Query(ctx,
		fmt.Sprintf(`SELECT pt.gateway,
		        COUNT(*) FILTER (WHERE pt.type='capture'),
		        COALESCE(SUM(pt.amount) FILTER (WHERE pt.type='capture' AND pt.status='success'),0),
		        COALESCE(SUM(ABS(pt.amount)) FILTER (WHERE pt.type='refund' AND pt.status='success'),0)
		 FROM payment_transactions pt WHERE pt.tenant_id=$1%s
		 GROUP BY pt.gateway ORDER BY pt.gateway`, drClause),
		drArgs...)
	if err != nil {
		return stats, nil
	}
	defer rows.Close()

	stats.ByGateway = make([]models.GatewaySummary, 0)
	for rows.Next() {
		var gs models.GatewaySummary
		if err := rows.Scan(&gs.Gateway, &gs.Count, &gs.TotalAmount, &gs.RefundedAmount); err != nil {
			continue
		}
		stats.ByGateway = append(stats.ByGateway, gs)
	}

	return stats, nil
}

// ---------------- Helpers ----------------

// pgtypeText is a helper to convert a string to pgtype.Text for nullable columns.
var _ = pgtype.Text{}
var _ = time.Now
