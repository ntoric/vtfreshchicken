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

// ---------------- Order Returns / Replacements / Refunds ----------------

// ReturnListFilter holds optional filters for listing returns.
type ReturnListFilter struct {
	Status string
	Type   string
	Search string // return_number, order_number, customer name/email
	Dr     DateRangeFilter
}

// ListOrderReturns returns paginated returns for a tenant with optional filters.
func (s *Store) ListOrderReturns(ctx context.Context, tenantID uuid.UUID, f ReturnListFilter, limit, offset int) ([]models.OrderReturn, int, error) {
	where := "WHERE r.tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if f.Status != "" {
		where += fmt.Sprintf(" AND r.status=$%d", argIdx)
		args = append(args, f.Status)
		argIdx++
	}
	if f.Type != "" {
		where += fmt.Sprintf(" AND r.type=$%d", argIdx)
		args = append(args, f.Type)
		argIdx++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (r.return_number ILIKE $%d OR o.id::text ILIKE $%d OR COALESCE(o.customer_name,'') ILIKE $%d OR COALESCE(o.customer_email,'') ILIKE $%d)", argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+f.Search+"%")
		argIdx++
	}
	drClause, args, argIdx := dateRangeClause("r.created_at", f.Dr, args, argIdx)
	where += drClause

	// Count
	var total int
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM order_returns r LEFT JOIN orders o ON o.id=r.order_id %s`, where)
	if err := s.Pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// List
	listQ := fmt.Sprintf(`
		SELECT r.id, r.tenant_id, r.order_id, r.return_number, r.type, r.status,
		       r.reason, r.refund_amount, r.refund_method, r.restock,
		       r.status_history, r.created_by,
		       to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.completed_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       COALESCE(o.customer_name,''), COALESCE(o.customer_email,''),
		       o.status
		FROM order_returns r
		LEFT JOIN orders o ON o.id = r.order_id
		%s
		ORDER BY r.created_at DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.Pool.Query(ctx, listQ, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	returns := []models.OrderReturn{}
	for rows.Next() {
		var r models.OrderReturn
		var statusHistory []byte
		var createdAtStr, updatedAtStr string; var completedAtStr *string
		var createdBy *uuid.UUID
		err := rows.Scan(
			&r.ID, &r.TenantID, &r.OrderID, &r.ReturnNumber, &r.Type, &r.Status,
			&r.Reason, &r.RefundAmount, &r.RefundMethod, &r.Restock,
			&statusHistory, &createdBy,
			&createdAtStr, &updatedAtStr, &completedAtStr,
			&r.CustomerName, &r.CustomerEmail, &r.OrderStatus,
		)
		if err != nil {
			return nil, 0, err
		}
		r.CreatedBy = createdBy
		r.CreatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", createdAtStr)
		r.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", updatedAtStr)
		if statusHistory != nil {
			_ = json.Unmarshal(statusHistory, &r.StatusHistory)
		}
		if completedAtStr != nil && *completedAtStr != "" {
			t, err := time.Parse("2006-01-02T15:04:05Z07", *completedAtStr)
			if err == nil {
				r.CompletedAt = &t
			}
		}
		returns = append(returns, r)
	}
	return returns, total, nil
}

// GetOrderReturn fetches a single return with its items.
func (s *Store) GetOrderReturn(ctx context.Context, tenantID, returnID uuid.UUID) (*models.OrderReturn, error) {
	var r models.OrderReturn
	var statusHistory []byte
	var createdAtStr, updatedAtStr string; var completedAtStr *string
	var createdBy *uuid.UUID

	err := s.Pool.QueryRow(ctx, `
		SELECT r.id, r.tenant_id, r.order_id, r.return_number, r.type, r.status,
		       r.reason, r.refund_amount, r.refund_method, r.restock,
		       r.status_history, r.created_by,
		       to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.completed_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       COALESCE(o.customer_name,''), COALESCE(o.customer_email,''),
		       o.status
		FROM order_returns r
		LEFT JOIN orders o ON o.id = r.order_id
		WHERE r.id=$1 AND r.tenant_id=$2`, returnID, tenantID).
		Scan(
			&r.ID, &r.TenantID, &r.OrderID, &r.ReturnNumber, &r.Type, &r.Status,
			&r.Reason, &r.RefundAmount, &r.RefundMethod, &r.Restock,
			&statusHistory, &createdBy,
			&createdAtStr, &updatedAtStr, &completedAtStr,
			&r.CustomerName, &r.CustomerEmail, &r.OrderStatus,
		)
	if err != nil {
		return nil, err
	}
	r.CreatedBy = createdBy
	r.CreatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", createdAtStr)
	r.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", updatedAtStr)
	if statusHistory != nil {
		_ = json.Unmarshal(statusHistory, &r.StatusHistory)
	}
	if completedAtStr != nil && *completedAtStr != "" {
		t, err := time.Parse("2006-01-02T15:04:05Z07", *completedAtStr)
		if err == nil {
			r.CompletedAt = &t
		}
	}

	// Load items
	items, err := s.listReturnItems(ctx, returnID)
	if err != nil {
		return nil, err
	}
	r.Items = items
	return &r, nil
}

func (s *Store) listReturnItems(ctx context.Context, returnID uuid.UUID) ([]models.OrderReturnItem, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, return_id, order_item_id, product_id, variant_id,
		       name, COALESCE(sku,''), quantity, unit_price, line_total, COALESCE(reason,'')
		FROM order_return_items WHERE return_id=$1`, returnID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []models.OrderReturnItem{}
	for rows.Next() {
		var it models.OrderReturnItem
		if err := rows.Scan(&it.ID, &it.ReturnID, &it.OrderItemID, &it.ProductID, &it.VariantID,
			&it.Name, &it.SKU, &it.Quantity, &it.UnitPrice, &it.LineTotal, &it.Reason); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, nil
}

// ListReturnsByOrder returns all returns for a specific order.
func (s *Store) ListReturnsByOrder(ctx context.Context, tenantID, orderID uuid.UUID) ([]models.OrderReturn, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT r.id, r.tenant_id, r.order_id, r.return_number, r.type, r.status,
		       r.reason, r.refund_amount, r.refund_method, r.restock,
		       r.status_history, r.created_by,
		       to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.completed_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       COALESCE(o.customer_name,''), COALESCE(o.customer_email,''),
		       o.status
		FROM order_returns r
		LEFT JOIN orders o ON o.id = r.order_id
		WHERE r.order_id=$1 AND r.tenant_id=$2
		ORDER BY r.created_at DESC`, orderID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	returns := []models.OrderReturn{}
	for rows.Next() {
		var r models.OrderReturn
		var statusHistory []byte
		var createdAtStr, updatedAtStr string; var completedAtStr *string
		var createdBy *uuid.UUID
		err := rows.Scan(
			&r.ID, &r.TenantID, &r.OrderID, &r.ReturnNumber, &r.Type, &r.Status,
			&r.Reason, &r.RefundAmount, &r.RefundMethod, &r.Restock,
			&statusHistory, &createdBy,
			&createdAtStr, &updatedAtStr, &completedAtStr,
			&r.CustomerName, &r.CustomerEmail, &r.OrderStatus,
		)
		if err != nil {
			return nil, err
		}
		r.CreatedBy = createdBy
		r.CreatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", createdAtStr)
		r.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", updatedAtStr)
		if statusHistory != nil {
			_ = json.Unmarshal(statusHistory, &r.StatusHistory)
		}
		if completedAtStr != nil && *completedAtStr != "" {
			t, err := time.Parse("2006-01-02T15:04:05Z07", *completedAtStr)
			if err == nil {
				r.CompletedAt = &t
			}
		}
		returns = append(returns, r)
	}
	return returns, nil
}

// CreateOrderReturn creates a new return/replacement request for an order.
func (s *Store) CreateOrderReturn(ctx context.Context, tenantID uuid.UUID, ret *models.OrderReturn, req *models.ReturnRequest) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Validate the order exists and belongs to the tenant
	var orderStatus string
	err = tx.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1 AND tenant_id=$2`, ret.OrderID, tenantID).Scan(&orderStatus)
	if err != nil {
		return fmt.Errorf("order not found: %w", err)
	}

	// Only allow returns for delivered or shipped orders
	if orderStatus != "delivered" && orderStatus != "shipped" && orderStatus != "paid" && orderStatus != "processing" {
		return fmt.Errorf("cannot create return for order with status '%s'", orderStatus)
	}

	// Generate return number: RET-YYYYMMDD-XXXX
	returnNumber := fmt.Sprintf("RET-%s-%04d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)

	// Calculate refund amount from requested items
	var refundAmount float64

	// Build and insert return items, computing refund amount
	type itemData struct {
		OrderItemID uuid.UUID
		Qty         int
		Reason      string
	}
	var itemsData []itemData
	for _, ri := range req.Items {
		oid, err := uuid.Parse(ri.OrderItemID)
		if err != nil {
			return fmt.Errorf("invalid order_item_id: %s", ri.OrderItemID)
		}
		if ri.Quantity <= 0 {
			return fmt.Errorf("return quantity must be positive for item %s", ri.OrderItemID)
		}
		itemsData = append(itemsData, itemData{OrderItemID: oid, Qty: ri.Quantity, Reason: ri.Reason})
	}

	if len(itemsData) == 0 {
		return fmt.Errorf("at least one return item is required")
	}

	// Fetch order item details and validate quantities
	for _, id := range itemsData {
		var name, sku string
		var productID, variantID *uuid.UUID
		var orderItemQty int
		var unitPrice, lineTotal float64
		err = tx.QueryRow(ctx, `
			SELECT name, COALESCE(sku,''), product_id, variant_id, quantity, unit_price, line_total
			FROM order_items WHERE id=$1`, id.OrderItemID).
			Scan(&name, &sku, &productID, &variantID, &orderItemQty, &unitPrice, &lineTotal)
		if err != nil {
			return fmt.Errorf("order item not found: %w", err)
		}
		// Check cumulative returned quantity for this order item
		var alreadyReturned int
		_ = tx.QueryRow(ctx, `
			SELECT COALESCE(SUM(ori.quantity), 0)
			FROM order_return_items ori
			JOIN order_returns r ON r.id = ori.return_id
			WHERE ori.order_item_id = $1 AND r.status NOT IN ('rejected', 'cancelled')`, id.OrderItemID).Scan(&alreadyReturned)
		available := orderItemQty - alreadyReturned
		if id.Qty > available {
			return fmt.Errorf("return quantity %d exceeds available quantity %d (already returned %d) for item %s", id.Qty, available, alreadyReturned, name)
		}
		refundAmount += unitPrice * float64(id.Qty)
	}

	// Set defaults
	if req.RefundMethod == "" {
		req.RefundMethod = "original"
	}
	if req.Type == "" {
		req.Type = "refund"
	}
	if req.Type == "replacement" || req.Type == "exchange" {
		req.RefundMethod = "none"
	}

	// Create the return record
	event := models.ReturnStatusEvent{Status: "requested", Timestamp: time.Now(), Actor: "admin"}
	eventJSON, _ := json.Marshal([]models.ReturnStatusEvent{event})

	err = tx.QueryRow(ctx, `
		INSERT INTO order_returns (tenant_id, order_id, return_number, type, status, reason,
		          refund_amount, refund_method, restock, status_history, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
		RETURNING id, created_at, updated_at`,
		tenantID, ret.OrderID, returnNumber, req.Type, "requested", req.Reason,
		refundAmount, req.RefundMethod, req.Restock, eventJSON, ret.CreatedBy).
		Scan(&ret.ID, &ret.CreatedAt, &ret.UpdatedAt)
	if err != nil {
		return err
	}

	ret.TenantID = tenantID
	ret.ReturnNumber = returnNumber
	ret.Type = req.Type
	ret.Status = "requested"
	ret.Reason = req.Reason
	ret.RefundAmount = refundAmount
	ret.RefundMethod = req.RefundMethod
	ret.Restock = req.Restock
	ret.StatusHistory = []models.ReturnStatusEvent{event}

	// Insert return items
	for _, id := range itemsData {
		var name, sku string
		var productID, variantID *uuid.UUID
		var orderItemQty int
		var unitPrice float64
		err = tx.QueryRow(ctx, `
			SELECT name, COALESCE(sku,''), product_id, variant_id, quantity, unit_price
			FROM order_items WHERE id=$1`, id.OrderItemID).
			Scan(&name, &sku, &productID, &variantID, &orderItemQty, &unitPrice)
		if err != nil {
			return err
		}
		lineTotal := unitPrice * float64(id.Qty)
		_, err = tx.Exec(ctx, `
			INSERT INTO order_return_items (return_id, order_item_id, product_id, variant_id,
			       name, sku, quantity, unit_price, line_total, reason)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			ret.ID, id.OrderItemID, productID, variantID, name, sku, id.Qty, unitPrice, lineTotal, id.Reason)
		if err != nil {
			return err
		}
	}

	// Update order return_status
	_, err = tx.Exec(ctx, `UPDATE orders SET return_status='return_requested', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, ret.OrderID, tenantID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// UpdateReturnStatus transitions a return to a new status, performing side effects as needed.
func (s *Store) UpdateReturnStatus(ctx context.Context, tenantID, returnID uuid.UUID, newStatus, note, actor string) (*models.OrderReturn, error) {
	// Fetch current status
	var currentStatus string
	var orderID uuid.UUID
	var retType, refundMethod string
	var restock bool
	var refundAmount float64
	err := s.Pool.QueryRow(ctx,
		`SELECT status, order_id, type, refund_method, restock, refund_amount FROM order_returns WHERE id=$1 AND tenant_id=$2`,
		returnID, tenantID).Scan(&currentStatus, &orderID, &retType, &refundMethod, &restock, &refundAmount)
	if err != nil {
		return nil, err
	}

	if !models.IsValidReturnTransition(currentStatus, newStatus) {
		return nil, fmt.Errorf("invalid return status transition: %s → %s", currentStatus, newStatus)
	}

	now := time.Now()
	event := models.ReturnStatusEvent{Status: newStatus, Timestamp: now, Actor: actor, Note: note}
	eventJSON, _ := json.Marshal([]models.ReturnStatusEvent{event})

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Update return status
	setClauses := []string{"status=$3", "updated_at=NOW()", "status_history = status_history || $4::jsonb"}
	args := []interface{}{returnID, tenantID, newStatus, eventJSON}
	argIdx := 5

	if newStatus == "completed" {
		setClauses = append(setClauses, fmt.Sprintf("completed_at=$%d", argIdx))
		args = append(args, now)
		argIdx++
	}

	query := fmt.Sprintf(`UPDATE order_returns SET %s WHERE id=$1 AND tenant_id=$2`,
		joinStrings(setClauses, ", "))
	_, err = tx.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	// Side effects on completion
	if newStatus == "completed" {
		// Restock items if requested
		if restock {
			if err := s.restoreReturnStockTx(ctx, tx, tenantID, returnID); err != nil {
				// Log but don't fail
				_ = err
			}
		}

		// Process refund if type is refund and method is not 'none'
		if retType == "refund" && refundMethod != "none" && refundAmount > 0 {
			if err := s.processReturnRefundTx(ctx, tx, tenantID, orderID, refundAmount, refundMethod, note); err != nil {
				// Log but don't fail the status update
				_ = err
			}
		}

		// Update order return_status
		_, _ = tx.Exec(ctx, `UPDATE orders SET return_status='return_completed', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, orderID, tenantID)

		// Update order status to 'refunded' for refund returns and append to status history
		if retType == "refund" {
			orderEvent := models.OrderStatusEvent{
				Status:    "refunded",
				Timestamp: now,
				Actor:     actor,
				Note:      fmt.Sprintf("Return %s completed — refund processed", retType),
			}
			orderEventJSON, _ := json.Marshal([]models.OrderStatusEvent{orderEvent})
			_, _ = tx.Exec(ctx,
				`UPDATE orders SET status='refunded', status_history = status_history || $3::jsonb, updated_at=NOW()
				 WHERE id=$1 AND tenant_id=$2`,
				orderID, tenantID, orderEventJSON)
		}
	} else if newStatus == "approved" {
		_, _ = tx.Exec(ctx, `UPDATE orders SET return_status='return_approved', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, orderID, tenantID)

		// Update order status to 'refunded' for refund returns and append to status history
		if retType == "refund" {
			orderEvent := models.OrderStatusEvent{
				Status:    "refunded",
				Timestamp: now,
				Actor:     actor,
				Note:      fmt.Sprintf("Return %s approved", retType),
			}
			orderEventJSON, _ := json.Marshal([]models.OrderStatusEvent{orderEvent})
			_, _ = tx.Exec(ctx,
				`UPDATE orders SET status='refunded', status_history = status_history || $3::jsonb, updated_at=NOW()
				 WHERE id=$1 AND tenant_id=$2`,
				orderID, tenantID, orderEventJSON)
		}

		// Auto-create a replacement/exchange order when the return type is replacement or exchange
		if retType == "replacement" || retType == "exchange" {
			if err := s.createReplacementOrderTx(ctx, tx, tenantID, orderID, returnID, retType); err != nil {
				// Log but don't fail the status update
				_ = err
			}
		}
	} else if newStatus == "rejected" || newStatus == "cancelled" {
		// Clear return_status on order only if no other active returns exist
		var activeCount int
		_ = tx.QueryRow(ctx,
			`SELECT COUNT(*) FROM order_returns WHERE order_id=$1 AND tenant_id=$2 AND status IN ('requested','approved')`,
			orderID, tenantID).Scan(&activeCount)
		if activeCount == 0 {
			_, _ = tx.Exec(ctx, `UPDATE orders SET return_status=NULL, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, orderID, tenantID)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.GetOrderReturn(ctx, tenantID, returnID)
}

// restoreReturnStockTx restores stock for returned items within a transaction.
func (s *Store) restoreReturnStockTx(ctx context.Context, tx pgx.Tx, tenantID, returnID uuid.UUID) error {
	rows, err := tx.Query(ctx,
		`SELECT product_id, variant_id, quantity FROM order_return_items WHERE return_id=$1`, returnID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var productID *uuid.UUID
		var variantID *uuid.UUID
		var qty int
		if err := rows.Scan(&productID, &variantID, &qty); err != nil {
			return err
		}
		if variantID != nil {
			_, _ = tx.Exec(ctx, `UPDATE variants SET stock = stock + $1 WHERE id=$2`, qty, *variantID)
		} else if productID != nil {
			_, _ = tx.Exec(ctx, `UPDATE products SET stock = stock + $1 WHERE id=$2`, qty, *productID)
		}
		// Record stock movement
		_, _ = tx.Exec(ctx,
			`INSERT INTO stock_movements (tenant_id, product_id, variant_id, movement_type, quantity, reference)
			 VALUES ($1,$2,$3,'return',$4,$5)`,
			tenantID, productID, variantID, qty, returnID.String())
	}
	return nil
}

// createReplacementOrderTx creates a new order to ship replacement/exchange items
// when a return of type 'replacement' or 'exchange' is approved. The new order:
//   - Links back to the original order via replaces_order_id
//   - Links to the return via return_id
//   - Is tagged with order_tag = 'replacement' or 'exchange'
//   - Has all totals set to 0 (no additional payment)
//   - Starts at status 'processing' (ready to ship)
//   - Copies customer info and addresses from the original order
//   - Decrements stock for each replacement item
func (s *Store) createReplacementOrderTx(ctx context.Context, tx pgx.Tx, tenantID, originalOrderID, returnID uuid.UUID, orderTag string) error {
	// Fetch original order for customer info, currency, and addresses
	var userID *uuid.UUID
	var currencyCode, customerName, customerEmail, paymentMethod, shippingMethod string
	var shippingAddr, billingAddr []byte
	err := tx.QueryRow(ctx,
		`SELECT user_id, COALESCE(currency_code,'USD'), COALESCE(customer_name,''), COALESCE(customer_email,''),
		        COALESCE(payment_method,''), COALESCE(shipping_method,''),
		        shipping_address, billing_address
		 FROM orders WHERE id=$1 AND tenant_id=$2`,
		originalOrderID, tenantID).
		Scan(&userID, &currencyCode, &customerName, &customerEmail, &paymentMethod, &shippingMethod, &shippingAddr, &billingAddr)
	if err != nil {
		return fmt.Errorf("failed to fetch original order for replacement: %w", err)
	}

	// Fetch return items to know what to ship
	type returnItemData struct {
		ProductID  *uuid.UUID
		VariantID  *uuid.UUID
		Name       string
		SKU        string
		Quantity   int
		UnitPrice  float64
		LineTotal  float64
	}
	rows, err := tx.Query(ctx,
		`SELECT product_id, variant_id, name, COALESCE(sku,''), quantity, unit_price, line_total
		 FROM order_return_items WHERE return_id=$1`, returnID)
	if err != nil {
		return fmt.Errorf("failed to fetch return items: %w", err)
	}
	var items []returnItemData
	for rows.Next() {
		var ri returnItemData
		if err := rows.Scan(&ri.ProductID, &ri.VariantID, &ri.Name, &ri.SKU, &ri.Quantity, &ri.UnitPrice, &ri.LineTotal); err != nil {
			rows.Close()
			return err
		}
		items = append(items, ri)
	}
	rows.Close()
	if len(items) == 0 {
		return fmt.Errorf("no return items found for return %s", returnID)
	}

	// Create the replacement order — all totals are 0 (no payment needed)
	now := time.Now()
	initialHistory := []models.OrderStatusEvent{
		{Status: "processing", Timestamp: now, Actor: "system", Note: fmt.Sprintf("Auto-created %s order for approved return", orderTag)},
	}
	historyJSON, _ := json.Marshal(initialHistory)

	var newOrderID uuid.UUID
	err = tx.QueryRow(ctx,
		`INSERT INTO orders (tenant_id, user_id, status, subtotal, discount_total, shipping_total, tax_total,
		      grand_total, currency_code, shipping_address, billing_address,
		      payment_method, shipping_method, customer_name, customer_email, status_history,
		      replaces_order_id, return_id, order_tag)
		 VALUES ($1,$2,'processing',0,0,0,0,0,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)
		 RETURNING id`,
		tenantID, userID, currencyCode, shippingAddr, billingAddr,
		paymentMethod, shippingMethod, customerName, customerEmail, historyJSON,
		originalOrderID, returnID, orderTag).Scan(&newOrderID)
	if err != nil {
		return fmt.Errorf("failed to create replacement order: %w", err)
	}

	// Insert order items and decrement stock
	for _, ri := range items {
		_, err := tx.Exec(ctx,
			`INSERT INTO order_items (order_id, product_id, variant_id, name, sku, quantity, unit_price, line_total)
			 VALUES ($1,$2,$3,$4,$5,$6,0,0)`,
			newOrderID, ri.ProductID, ri.VariantID, ri.Name, ri.SKU, ri.Quantity)
		if err != nil {
			return fmt.Errorf("failed to insert replacement order item: %w", err)
		}

		// Decrement stock
		if ri.VariantID != nil {
			tag, sErr := tx.Exec(ctx,
				`UPDATE variants SET stock = stock - $1 WHERE id=$2 AND stock >= $1`,
				ri.Quantity, *ri.VariantID)
			if sErr != nil {
				return fmt.Errorf("failed to decrement variant stock: %w", sErr)
			}
			if tag.RowsAffected() == 0 {
				return fmt.Errorf("insufficient stock for replacement variant %s", ri.VariantID)
			}
		} else if ri.ProductID != nil {
			tag, sErr := tx.Exec(ctx,
				`UPDATE products SET stock = stock - $1 WHERE id=$2 AND stock >= $1`,
				ri.Quantity, *ri.ProductID)
			if sErr != nil {
				return fmt.Errorf("failed to decrement product stock: %w", sErr)
			}
			if tag.RowsAffected() == 0 {
				return fmt.Errorf("insufficient stock for replacement product %s", ri.Name)
			}
		}

		// Record stock movement
		_, _ = tx.Exec(ctx,
			`INSERT INTO stock_movements (tenant_id, product_id, variant_id, movement_type, quantity, reference)
			 VALUES ($1,$2,$3,'order',$4,$5)`,
			tenantID, ri.ProductID, ri.VariantID, -ri.Quantity, newOrderID.String())
	}

	// Record a zero-amount payment transaction for tracking
	_, _ = tx.Exec(ctx,
		`INSERT INTO payment_transactions (tenant_id, order_id, user_id, gateway, type, status, amount, currency_code, customer_email, customer_name)
		 VALUES ($1,$2,$3,$4,'capture','success',0,$5,$6,$7)`,
		tenantID, newOrderID, userID, orderTag, currencyCode, customerEmail, customerName)

	return nil
}

// processReturnRefundTx creates a refund payment transaction for a completed return.
// For wallet refunds, it also credits the customer's wallet.
func (s *Store) processReturnRefundTx(ctx context.Context, tx pgx.Tx, tenantID, orderID uuid.UUID, amount float64, method, reason string) error {
	// Find the original capture transaction for this order
	var txnID uuid.UUID
	var gateway, currencyCode, gatewayTxnID, customerEmail, customerName string
	var userID *uuid.UUID
	err := tx.QueryRow(ctx, `
		SELECT id, gateway, COALESCE(gateway_txn_id,''), currency_code,
		       COALESCE(customer_email,''), COALESCE(customer_name,''), user_id
		FROM payment_transactions
		WHERE order_id=$1 AND tenant_id=$2 AND type='capture' AND status='success'
		ORDER BY created_at DESC LIMIT 1`, orderID, tenantID).
		Scan(&txnID, &gateway, &gatewayTxnID, &currencyCode, &customerEmail, &customerName, &userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			// No capture transaction — try to find the customer from the order
			_ = tx.QueryRow(ctx, `SELECT user_id FROM orders WHERE id=$1 AND tenant_id=$2`, orderID, tenantID).Scan(&userID)
			// Still create a refund record with a generic gateway
			gateway = "manual"
			currencyCode = "USD"
		} else {
			return err
		}
	}

	// Create a refund transaction record
	resp := map[string]interface{}{
		"refund_reason": reason,
		"return_refund": true,
		"refund_method": method,
	}
	respJSON, _ := json.Marshal(resp)

	_, err = tx.Exec(ctx, `
		INSERT INTO payment_transactions (tenant_id, order_id, gateway, gateway_txn_id,
		          type, status, amount, currency_code, gateway_response,
		          customer_email, customer_name, user_id)
		VALUES ($1,$2,$3,$4,'refund','success',$5,$6,$7,$8,$9,$10)`,
		tenantID, orderID, gateway, gatewayTxnID, -amount, currencyCode, respJSON, customerEmail, customerName, userID)
	if err != nil {
		return err
	}

	// Update order refunded_amount
	_, err = tx.Exec(ctx,
		`UPDATE orders SET refunded_amount = (
		     SELECT COALESCE(SUM(ABS(amount)),0) FROM payment_transactions
		     WHERE order_id=$1 AND type='refund' AND status='success'
		 ) WHERE id=$1`, orderID)
	if err != nil {
		return err
	}

	// For wallet refund method, credit the customer's wallet
	if method == "wallet" && userID != nil {
		desc := fmt.Sprintf("Refund for return: %s", reason)
		ref := fmt.Sprintf("return-refund-order:%s", orderID)
		var walletID uuid.UUID
		wErr := tx.QueryRow(ctx, `
			SELECT id FROM customer_wallets
			WHERE tenant_id=$1 AND user_id=$2
			FOR UPDATE`, tenantID, *userID).Scan(&walletID)
		if wErr == nil {
			_, wErr = tx.Exec(ctx, `
				UPDATE customer_wallets SET balance = balance + $3, updated_at = NOW()
				WHERE id=$1 AND tenant_id=$2`, walletID, tenantID, amount)
			if wErr == nil {
				_, _ = tx.Exec(ctx, `
					INSERT INTO wallet_transactions (tenant_id, wallet_id, user_id, order_id, type, source, amount, balance_after, currency_code, description, reference)
					SELECT $1, $2, $3, $4, 'credit', 'refund', $5,
					       (SELECT balance FROM customer_wallets WHERE id=$2),
					       $6, $7, $8`,
					tenantID, walletID, *userID, orderID, amount, currencyCode, desc, ref)
			}
		}
	}

	// For store_credit method, we use the wallet as store credit (same mechanism)
	if method == "store_credit" && userID != nil {
		var walletID uuid.UUID
		wErr := tx.QueryRow(ctx, `
			INSERT INTO customer_wallets (tenant_id, user_id, balance, currency_code)
			VALUES ($1, $2, 0, $3)
			ON CONFLICT (tenant_id, user_id) DO UPDATE SET updated_at = NOW()
			RETURNING id`, tenantID, *userID, currencyCode).Scan(&walletID)
		if wErr == nil {
			_, wErr = tx.Exec(ctx, `
				UPDATE customer_wallets SET balance = balance + $3, updated_at = NOW()
				WHERE id=$1 AND tenant_id=$2`, walletID, tenantID, amount)
			if wErr == nil {
				_, _ = tx.Exec(ctx, `
					INSERT INTO wallet_transactions (tenant_id, wallet_id, user_id, order_id, type, source, amount, balance_after, currency_code, description, reference)
					SELECT $1, $2, $3, $4, 'credit', 'store_credit', $5,
					       (SELECT balance FROM customer_wallets WHERE id=$2),
					       $6, $7, $8`,
					tenantID, walletID, *userID, orderID, amount, currencyCode,
					fmt.Sprintf("Store credit for return: %s", reason),
					fmt.Sprintf("return-store-credit:%s", orderID))
			}
		}
	}

	return nil
}

// ReturnCountsByStatus returns counts of returns grouped by status.
func (s *Store) ReturnCountsByStatus(ctx context.Context, tenantID uuid.UUID) (map[string]int, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT status, COUNT(*) FROM order_returns WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := map[string]int{}
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		counts[status] = count
	}
	return counts, nil
}

// joinStrings joins strings with a separator (helper to avoid importing strings in some paths).
func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

// OrderBelongsToUser checks if an order belongs to a specific user (for customer-facing endpoints).
func (s *Store) OrderBelongsToUser(ctx context.Context, tenantID, orderID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM orders WHERE id=$1 AND tenant_id=$2 AND user_id=$3)`,
		orderID, tenantID, userID).Scan(&exists)
	return exists, err
}

// OrderReturnEligibility holds the computed return/refund/replacement eligibility for an order.
type OrderReturnEligibility struct {
	DeliveredAt          *time.Time `json:"delivered_at,omitempty"`
	ReturnsEnabled       bool       `json:"returns_enabled"`
	ReturnEligible       bool       `json:"return_eligible"`
	RefundEligible       bool       `json:"refund_eligible"`
	ReplacementEligible  bool       `json:"replacement_eligible"`
	ReturnExpiresAt      *time.Time `json:"return_expires_at,omitempty"`
	RefundExpiresAt      *time.Time `json:"refund_expires_at,omitempty"`
	ReplacementExpiresAt *time.Time `json:"replacement_expires_at,omitempty"`
	// Return type allowed flags (from product config, default: all true)
	ReturnAllowed      bool `json:"return_allowed"`
	RefundAllowed      bool `json:"refund_allowed"`
	ReplacementAllowed bool `json:"replacement_allowed"`
}

// GetOrderReturnEligibility computes return eligibility for an order based on
// its delivered_at timestamp and the product-specific / tenant period settings.
// For orders with multiple products, the most lenient (latest expiry) across all
// products is used, so the customer can initiate a return if any product is eligible.
func (s *Store) GetOrderReturnEligibility(ctx context.Context, tenantID, orderID uuid.UUID) (*OrderReturnEligibility, error) {
	// Load tenant-level defaults as fallback
	tenantReturn := 30
	tenantRefund := 30
	tenantReplacement := 15
	returnsEnabled := true
	if ts, err := s.GetTenantSettings(ctx, tenantID); err == nil {
		returnsEnabled = ts.ReturnsEnabled
		if ts.ReturnPeriodDays > 0 {
			tenantReturn = ts.ReturnPeriodDays
		}
		if ts.RefundPeriodDays > 0 {
			tenantRefund = ts.RefundPeriodDays
		}
		if ts.ReplacementPeriodDays > 0 {
			tenantReplacement = ts.ReplacementPeriodDays
		}
	}

	var deliveredAt *time.Time
	err := s.Pool.QueryRow(ctx,
		`SELECT delivered_at FROM orders WHERE id=$1 AND tenant_id=$2`,
		orderID, tenantID).Scan(&deliveredAt)
	if err != nil {
		return nil, err
	}

	// Load per-product period overrides and enabled flags for items in this order
	rows, err := s.Pool.Query(ctx,
		`SELECT DISTINCT p.return_period_days, p.refund_period_days, p.replacement_period_days,
		        p.return_enabled, p.refund_enabled, p.replacement_enabled
		 FROM order_items oi
		 JOIN products p ON p.id = oi.product_id
		 WHERE oi.order_id=$1`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Track the maximum (most lenient) period across all products
	maxReturn := tenantReturn
	maxRefund := tenantRefund
	maxReplacement := tenantReplacement
	// Track whether at least one product explicitly enables each type.
	// A type is allowed at order level if ANY product allows it (NULL or true).
	// It's only disallowed if ALL products explicitly set it to false.
	seenReturnEnabled := false
	seenRefundEnabled := false
	seenReplacementEnabled := false
	anyExplicitReturnFalse := false
	anyExplicitRefundFalse := false
	anyExplicitReplacementFalse := false
	hasProducts := false
	for rows.Next() {
		var pReturn, pRefund, pReplacement *int
		var pReturnEn, pRefundEn, pReplacementEn *bool
		if err := rows.Scan(&pReturn, &pRefund, &pReplacement, &pReturnEn, &pRefundEn, &pReplacementEn); err != nil {
			return nil, err
		}
		hasProducts = true
		if pReturn != nil && *pReturn > maxReturn {
			maxReturn = *pReturn
		}
		if pRefund != nil && *pRefund > maxRefund {
			maxRefund = *pRefund
		}
		if pReplacement != nil && *pReplacement > maxReplacement {
			maxReplacement = *pReplacement
		}
		if pReturnEn != nil {
			if *pReturnEn {
				seenReturnEnabled = true
			} else {
				anyExplicitReturnFalse = true
			}
		}
		if pRefundEn != nil {
			if *pRefundEn {
				seenRefundEnabled = true
			} else {
				anyExplicitRefundFalse = true
			}
		}
		if pReplacementEn != nil {
			if *pReplacementEn {
				seenReplacementEnabled = true
			} else {
				anyExplicitReplacementFalse = true
			}
		}
	}

	// Allowed = at least one product enables it (or NULL = enabled).
	// Only disallowed if all products explicitly disable it. The store-level
	// returns_enabled switch overrides everything.
	returnAllowed := returnsEnabled && (!hasProducts || seenReturnEnabled || !anyExplicitReturnFalse)
	refundAllowed := returnsEnabled && (!hasProducts || seenRefundEnabled || !anyExplicitRefundFalse)
	replacementAllowed := returnsEnabled && (!hasProducts || seenReplacementEnabled || !anyExplicitReplacementFalse)

	e := &OrderReturnEligibility{
		ReturnsEnabled:     returnsEnabled,
		ReturnAllowed:      returnAllowed,
		RefundAllowed:      refundAllowed,
		ReplacementAllowed: replacementAllowed,
		DeliveredAt:        deliveredAt,
	}
	if deliveredAt != nil {
		delivered := *deliveredAt
		retExp := delivered.AddDate(0, 0, maxReturn)
		refExp := delivered.AddDate(0, 0, maxRefund)
		repExp := delivered.AddDate(0, 0, maxReplacement)
		e.ReturnExpiresAt = &retExp
		e.RefundExpiresAt = &refExp
		e.ReplacementExpiresAt = &repExp
		now := time.Now()
		e.ReturnEligible = returnAllowed && now.Before(retExp)
		e.RefundEligible = refundAllowed && now.Before(refExp)
		e.ReplacementEligible = replacementAllowed && now.Before(repExp)
	}
	return e, nil
}

// ListReturnsByUser returns all returns for orders belonging to a specific user.
func (s *Store) ListReturnsByUser(ctx context.Context, tenantID, userID uuid.UUID, limit, offset int) ([]models.OrderReturn, int, error) {
	// Count total
	var total int
	err := s.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM order_returns r
		 JOIN orders o ON o.id = r.order_id
		 WHERE r.tenant_id=$1 AND o.user_id=$2`, tenantID, userID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT r.id, r.tenant_id, r.order_id, r.return_number, r.type, r.status,
		       r.reason, r.refund_amount, r.refund_method, r.restock,
		       r.status_history, r.created_by,
		       to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.updated_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       to_char(r.completed_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
		       COALESCE(o.customer_name,''), COALESCE(o.customer_email,''),
		       o.status
		FROM order_returns r
		LEFT JOIN orders o ON o.id = r.order_id
		WHERE r.tenant_id=$1 AND o.user_id=$2
		ORDER BY r.created_at DESC
		LIMIT $3 OFFSET $4`, tenantID, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	returns := []models.OrderReturn{}
	for rows.Next() {
		var r models.OrderReturn
		var statusHistory []byte
		var createdAtStr, updatedAtStr string
		var completedAtStr *string
		var createdBy *uuid.UUID
		err := rows.Scan(
			&r.ID, &r.TenantID, &r.OrderID, &r.ReturnNumber, &r.Type, &r.Status,
			&r.Reason, &r.RefundAmount, &r.RefundMethod, &r.Restock,
			&statusHistory, &createdBy,
			&createdAtStr, &updatedAtStr, &completedAtStr,
			&r.CustomerName, &r.CustomerEmail, &r.OrderStatus,
		)
		if err != nil {
			return nil, 0, err
		}
		r.CreatedBy = createdBy
		r.CreatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", createdAtStr)
		r.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05Z07", updatedAtStr)
		if statusHistory != nil {
			_ = json.Unmarshal(statusHistory, &r.StatusHistory)
		}
		if completedAtStr != nil && *completedAtStr != "" {
			t, err := time.Parse("2006-01-02T15:04:05Z07", *completedAtStr)
			if err == nil {
				r.CompletedAt = &t
			}
		}
		returns = append(returns, r)
	}
	return returns, total, nil
}

// CheckAndFulfillOrder transitions a delivered order to 'fulfilled' if:
//   - The order status is 'delivered'
//   - There are no active returns (requested or approved) for the order
//   - All return/refund/replacement periods have expired
//
// This is safe to call on any order — it no-ops if the conditions are not met.
// Returns true if the order was transitioned to fulfilled.
func (s *Store) CheckAndFulfillOrder(ctx context.Context, tenantID, orderID uuid.UUID) (bool, error) {
	// Quick check: is the order delivered?
	var status string
	err := s.Pool.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1 AND tenant_id=$2`, orderID, tenantID).Scan(&status)
	if err != nil {
		return false, err
	}
	if status != "delivered" {
		return false, nil
	}

	// Check for active returns (requested or approved)
	var activeReturns int
	err = s.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM order_returns WHERE order_id=$1 AND tenant_id=$2 AND status IN ('requested','approved')`,
		orderID, tenantID).Scan(&activeReturns)
	if err != nil {
		return false, err
	}
	if activeReturns > 0 {
		return false, nil
	}

	// Check if all return periods are exhausted
	eligibility, err := s.GetOrderReturnEligibility(ctx, tenantID, orderID)
	if err != nil {
		return false, err
	}
	if eligibility.DeliveredAt == nil {
		return false, nil
	}

	// The order is fulfilled only when NO return type is still eligible
	// (all periods expired or all types disabled)
	if eligibility.ReturnEligible || eligibility.RefundEligible || eligibility.ReplacementEligible {
		return false, nil
	}

	// All conditions met — transition to fulfilled
	event := models.OrderStatusEvent{Status: "fulfilled", Timestamp: time.Now(), Actor: "system", Note: "Auto-fulfilled: return periods expired and no active returns"}
	eventJSON, _ := json.Marshal([]models.OrderStatusEvent{event})
	_, err = s.Pool.Exec(ctx,
		`UPDATE orders SET status='fulfilled', updated_at=NOW(),
		        status_history = status_history || $3::jsonb
		 WHERE id=$1 AND tenant_id=$2 AND status='delivered'`,
		orderID, tenantID, eventJSON)
	if err != nil {
		return false, err
	}
	return true, nil
}

// FulfillDeliveredOrders scans all delivered orders across all tenants and
// transitions eligible ones to 'fulfilled'. Designed to be called periodically
// by a background goroutine.
func (s *Store) FulfillDeliveredOrders(ctx context.Context) (int, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, tenant_id FROM orders WHERE status='delivered'`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type orderRef struct {
		ID       uuid.UUID
		TenantID uuid.UUID
	}
	var orders []orderRef
	for rows.Next() {
		var o orderRef
		if err := rows.Scan(&o.ID, &o.TenantID); err != nil {
			return 0, err
		}
		orders = append(orders, o)
	}

	fulfilled := 0
	for _, o := range orders {
		did, err := s.CheckAndFulfillOrder(ctx, o.TenantID, o.ID)
		if err != nil {
			continue
		}
		if did {
			fulfilled++
		}
	}
	return fulfilled, nil
}
