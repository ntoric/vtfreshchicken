package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/trucommerce/backend/internal/models"
)

// ============================================================
// Delivery partners (riders)
// ============================================================
//
// A delivery partner is a store user with the 'delivery_partner' role. Each
// partner is allocated to one or more branches via delivery_partner_branches
// and can only see/act on orders fulfilled by those branches. The flow:
//
//   staff marks order 'ready'  →  appears in partners' queue for that branch
//   partner claims  OR  staff assigns  →  delivery_partner_id set on the order
//   partner starts delivery            →  status 'shipped' (out for delivery)
//   partner completes                  →  status 'delivered'
//
// Claiming is a single-step shortcut: assign + out-for-delivery in one tap.

var (
	ErrNoBranchAllocated = errors.New("delivery partner has no branch allocated")
	ErrNotClaimable      = errors.New("order is not available for delivery")
	ErrNotAssignedToYou  = errors.New("order is not assigned to you")
	ErrBranchNotCovered  = errors.New("partner is not allocated to this order's branch")
)

// GetDeliveryPartnerBranchIDs returns the branch IDs allocated to a partner.
func (s *Store) GetDeliveryPartnerBranchIDs(ctx context.Context, tenantID, userID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT branch_id FROM delivery_partner_branches WHERE user_id=$1 AND tenant_id=$2 ORDER BY created_at`,
		userID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}

// ListDeliveryPartnerBranches returns the branches allocated to a partner.
func (s *Store) ListDeliveryPartnerBranches(ctx context.Context, tenantID, userID uuid.UUID) ([]models.Branch, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT `+branchColumns+` FROM branches b
		 JOIN delivery_partner_branches dpb ON dpb.branch_id=b.id
		 WHERE dpb.user_id=$1 AND dpb.tenant_id=$2 ORDER BY b.sort_order, b.name`,
		userID, tenantID)
	if err != nil {
		return nil, err
	}
	return scanBranchRows(rows)
}

// SetDeliveryPartnerBranches replaces a partner's branch allocation. Every
// branch must belong to the tenant. Callers must pass at least one branch for
// delivery partners.
func (s *Store) SetDeliveryPartnerBranches(ctx context.Context, tenantID, userID uuid.UUID, branchIDs []uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM delivery_partner_branches WHERE user_id=$1 AND tenant_id=$2`, userID, tenantID); err != nil {
		return err
	}
	for _, bid := range branchIDs {
		if _, err := tx.Exec(ctx,
			`INSERT INTO delivery_partner_branches (tenant_id, user_id, branch_id)
			 VALUES ($1,$2,$3) ON CONFLICT (user_id, branch_id) DO NOTHING`,
			tenantID, userID, bid); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// partnerBranchMap loads branch allocations for a set of users (used to
// decorate user listings with branch_ids / branch_names).
func (s *Store) partnerBranchMap(ctx context.Context, userIDs []uuid.UUID) (map[uuid.UUID][]uuid.UUID, map[uuid.UUID][]string, error) {
	ids := map[uuid.UUID][]uuid.UUID{}
	names := map[uuid.UUID][]string{}
	if len(userIDs) == 0 {
		return ids, names, nil
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT dpb.user_id, dpb.branch_id, b.name
		 FROM delivery_partner_branches dpb JOIN branches b ON b.id=dpb.branch_id
		 WHERE dpb.user_id = ANY($1) ORDER BY b.sort_order, b.name`, userIDs)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var uid, bid uuid.UUID
		var name string
		if err := rows.Scan(&uid, &bid, &name); err != nil {
			return nil, nil, err
		}
		ids[uid] = append(ids[uid], bid)
		names[uid] = append(names[uid], name)
	}
	return ids, names, nil
}

// LoadPartnerBranches populates BranchIDs/BranchNames on the given users
// (only delivery partners have allocations; others are left untouched).
func (s *Store) LoadPartnerBranches(ctx context.Context, users []models.User) error {
	uids := make([]uuid.UUID, 0, len(users))
	for _, u := range users {
		if u.Role == models.RoleDeliveryPartner {
			uids = append(uids, u.ID)
		}
	}
	ids, names, err := s.partnerBranchMap(ctx, uids)
	if err != nil {
		return err
	}
	for i := range users {
		users[i].BranchIDs = ids[users[i].ID]
		users[i].BranchNames = names[users[i].ID]
	}
	return nil
}

// ListDeliveryPartners returns active delivery partners for a tenant,
// optionally filtered to partners allocated to a specific branch. Each row
// carries the partner's branch IDs/names and their active delivery count.
func (s *Store) ListDeliveryPartners(ctx context.Context, tenantID uuid.UUID, branchID *uuid.UUID) ([]models.User, error) {
	where := `u.tenant_id=$1 AND u.role=$2 AND u.is_active=TRUE`
	args := []interface{}{tenantID, models.RoleDeliveryPartner}
	if branchID != nil {
		args = append(args, *branchID)
		where += fmt.Sprintf(` AND EXISTS (SELECT 1 FROM delivery_partner_branches d WHERE d.user_id=u.id AND d.branch_id=$%d)`, len(args))
	}
	rows, err := s.Pool.Query(ctx,
		`SELECT u.id, u.tenant_id, u.branch_id, u.email, u.password_hash, u.full_name, u.role, u.is_active, u.phone,
		        u.marketing_consent, u.admin_notes, u.last_login_at, u.created_at, u.updated_at,
		        (SELECT COUNT(*) FROM orders o WHERE o.delivery_partner_id=u.id AND o.status IN ('ready','shipped'))
		 FROM users u WHERE `+where+` ORDER BY u.full_name`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.User{}
	for rows.Next() {
		var u models.User
		var tid *uuid.UUID
		if err := rows.Scan(&u.ID, &tid, &u.BranchID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &u.IsActive, &u.Phone,
			&u.MarketingConsent, &u.AdminNotes, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt, &u.ActiveDeliveries); err != nil {
			return nil, err
		}
		u.TenantID = tid
		out = append(out, u)
	}
	if err := s.LoadPartnerBranches(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ---------------- Delivery order queue ----------------

// DeliveryOrderFilter scopes the delivery order listing.
type DeliveryOrderFilter struct {
	Statuses   []string    // required: statuses to include
	BranchIDs  []uuid.UUID // nil = no branch restriction (admins)
	PartnerID  *uuid.UUID  // only orders assigned to this partner
	Unassigned bool        // only orders without a partner
	Limit      int
	Offset     int
}

// ListDeliveryOrders returns orders for the delivery queue with a compact item
// list and the shipping address (partners need the drop-off location).
func (s *Store) ListDeliveryOrders(ctx context.Context, tenantID uuid.UUID, f DeliveryOrderFilter) ([]models.OrderWithDetails, int, error) {
	limit := f.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	conds := []string{"o.tenant_id=$1"}
	args := []interface{}{tenantID}
	argIdx := 2
	if len(f.Statuses) > 0 {
		conds = append(conds, fmt.Sprintf("o.status = ANY($%d)", argIdx))
		args = append(args, f.Statuses)
		argIdx++
	}
	if f.BranchIDs != nil {
		conds = append(conds, fmt.Sprintf("o.branch_id = ANY($%d)", argIdx))
		args = append(args, f.BranchIDs)
		argIdx++
	}
	if f.PartnerID != nil {
		conds = append(conds, fmt.Sprintf("o.delivery_partner_id = $%d", argIdx))
		args = append(args, *f.PartnerID)
		argIdx++
	}
	if f.Unassigned {
		conds = append(conds, "o.delivery_partner_id IS NULL")
	}
	where := strings.Join(conds, " AND ")

	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM orders o WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, f.Offset)
	rows, err := s.Pool.Query(ctx,
		fmt.Sprintf(`SELECT o.id, o.tenant_id, o.user_id, o.branch_id, COALESCE(b.name,''), o.status, o.subtotal, o.discount_total,
			o.shipping_total, o.tax_total, o.grand_total, o.currency_code,
			COALESCE(o.payment_method,''), COALESCE(o.customer_email,''), COALESCE(o.customer_name,''),
			o.delivery_partner_id, COALESCE(dp.full_name,''), o.delivery_assigned_at,
			o.shipping_address, o.created_at, o.updated_at,
			COALESCE((SELECT json_agg(json_build_object('id', oi.id, 'name', oi.name, 'quantity', oi.quantity) ORDER BY oi.id)
			          FROM order_items oi WHERE oi.order_id=o.id), '[]'::json)
		FROM orders o
		LEFT JOIN branches b ON b.id=o.branch_id
		LEFT JOIN users dp ON dp.id=o.delivery_partner_id
		WHERE %s ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1),
		args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []models.OrderWithDetails{}
	for rows.Next() {
		var o models.OrderWithDetails
		var shippingAddr, itemsJSON []byte
		if err := rows.Scan(&o.ID, &o.TenantID, &o.UserID, &o.BranchID, &o.BranchName, &o.Status, &o.Subtotal, &o.DiscountTotal,
			&o.ShippingTotal, &o.TaxTotal, &o.GrandTotal, &o.CurrencyCode,
			&o.PaymentMethod, &o.CustomerEmail, &o.CustomerName,
			&o.DeliveryPartnerID, &o.DeliveryPartnerName, &o.DeliveryAssignedAt,
			&shippingAddr, &o.CreatedAt, &o.UpdatedAt, &itemsJSON); err != nil {
			return nil, 0, err
		}
		if len(shippingAddr) > 0 {
			_ = json.Unmarshal(shippingAddr, &o.ShippingAddress)
		}
		if len(itemsJSON) > 0 {
			_ = json.Unmarshal(itemsJSON, &o.Items)
		}
		out = append(out, o)
	}
	return out, total, nil
}

// ---------------- Delivery lifecycle ----------------

// deliveryOrderState loads the mutable delivery fields of an order inside a tx.
func deliveryOrderState(ctx context.Context, tx pgx.Tx, tenantID, orderID uuid.UUID) (status string, branchID, partnerID *uuid.UUID, err error) {
	err = tx.QueryRow(ctx,
		`SELECT status, branch_id, delivery_partner_id FROM orders WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
		orderID, tenantID).Scan(&status, &branchID, &partnerID)
	return
}

// appendStatusEventLocked appends a status_history entry and bumps updated_at.
func appendStatusEventLocked(ctx context.Context, tx pgx.Tx, orderID uuid.UUID, ev models.OrderStatusEvent) error {
	evJSON, _ := json.Marshal(ev)
	_, err := tx.Exec(ctx,
		`UPDATE orders SET status_history = status_history || $2::jsonb, updated_at=NOW() WHERE id=$1`,
		orderID, evJSON)
	return err
}

func branchCovered(branchIDs []uuid.UUID, branchID *uuid.UUID) bool {
	if branchID == nil {
		return true // order has no branch — not branch-constrained
	}
	for _, id := range branchIDs {
		if id == *branchID {
			return true
		}
	}
	return false
}

// ClaimDelivery assigns the order to the partner and moves it straight to
// 'shipped' (out for delivery). Only unassigned 'ready' orders at a branch the
// partner covers can be claimed.
func (s *Store) ClaimDelivery(ctx context.Context, tenantID, orderID, partnerID uuid.UUID) error {
	branchIDs, err := s.GetDeliveryPartnerBranchIDs(ctx, tenantID, partnerID)
	if err != nil {
		return err
	}
	if len(branchIDs) == 0 {
		return ErrNoBranchAllocated
	}
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	status, branchID, assigned, err := deliveryOrderState(ctx, tx, tenantID, orderID)
	if err != nil {
		return err
	}
	if status != "ready" || assigned != nil {
		return ErrNotClaimable
	}
	if !branchCovered(branchIDs, branchID) {
		return ErrBranchNotCovered
	}
	tag, err := tx.Exec(ctx,
		`UPDATE orders SET delivery_partner_id=$3, delivery_assigned_at=NOW(),
		        status='shipped', shipped_at=NOW(), updated_at=NOW()
		 WHERE id=$1 AND tenant_id=$2 AND delivery_partner_id IS NULL`,
		orderID, tenantID, partnerID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotClaimable
	}
	if err := appendStatusEventLocked(ctx, tx, orderID, models.OrderStatusEvent{
		Status: "shipped", Timestamp: time.Now(), Actor: partnerID.String(), Note: "Claimed by delivery partner",
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// StartDelivery moves an assigned 'ready' order to 'shipped' — used when staff
// assigned the order to the partner (rather than the partner claiming it).
func (s *Store) StartDelivery(ctx context.Context, tenantID, orderID, partnerID uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	status, _, assigned, err := deliveryOrderState(ctx, tx, tenantID, orderID)
	if err != nil {
		return err
	}
	if assigned == nil || *assigned != partnerID {
		return ErrNotAssignedToYou
	}
	if status != "ready" {
		return fmt.Errorf("order is %s, not ready", status)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE orders SET status='shipped', shipped_at=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		orderID, tenantID); err != nil {
		return err
	}
	if err := appendStatusEventLocked(ctx, tx, orderID, models.OrderStatusEvent{
		Status: "shipped", Timestamp: time.Now(), Actor: partnerID.String(), Note: "Out for delivery",
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// CompleteDelivery marks a partner's 'shipped' order as delivered.
func (s *Store) CompleteDelivery(ctx context.Context, tenantID, orderID, partnerID uuid.UUID) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	status, _, assigned, err := deliveryOrderState(ctx, tx, tenantID, orderID)
	if err != nil {
		return err
	}
	if assigned == nil || *assigned != partnerID {
		return ErrNotAssignedToYou
	}
	if status != "shipped" {
		return fmt.Errorf("order is %s, not out for delivery", status)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE orders SET status='delivered', delivered_at=NOW(), updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		orderID, tenantID); err != nil {
		return err
	}
	if err := appendStatusEventLocked(ctx, tx, orderID, models.OrderStatusEvent{
		Status: "delivered", Timestamp: time.Now(), Actor: partnerID.String(), Note: "Delivered by delivery partner",
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// AssignDeliveryPartner assigns (or, when partnerID is nil, unassigns) a
// delivery partner to an order. Only allowed while the order is 'ready' or
// 'shipped'. The partner must be an active delivery_partner in the tenant and
// must be allocated to the order's branch (when it has one).
func (s *Store) AssignDeliveryPartner(ctx context.Context, tenantID, orderID uuid.UUID, partnerID *uuid.UUID, actor string) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	status, branchID, _, err := deliveryOrderState(ctx, tx, tenantID, orderID)
	if err != nil {
		return err
	}
	if status != "ready" && status != "shipped" {
		return fmt.Errorf("can only assign a delivery partner while the order is ready or out for delivery (order is %s)", status)
	}

	note := "Delivery partner unassigned"
	if partnerID != nil {
		var name string
		var active bool
		err := tx.QueryRow(ctx,
			`SELECT full_name, is_active FROM users WHERE id=$1 AND tenant_id=$2 AND role=$3`,
			*partnerID, tenantID, models.RoleDeliveryPartner).Scan(&name, &active)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return fmt.Errorf("delivery partner not found")
			}
			return err
		}
		if !active {
			return fmt.Errorf("delivery partner is disabled")
		}
		if branchID != nil {
			var covered bool
			err := tx.QueryRow(ctx,
				`SELECT EXISTS(SELECT 1 FROM delivery_partner_branches WHERE user_id=$1 AND branch_id=$2 AND tenant_id=$3)`,
				*partnerID, *branchID, tenantID).Scan(&covered)
			if err != nil {
				return err
			}
			if !covered {
				return ErrBranchNotCovered
			}
		}
		note = "Delivery assigned to " + name
	}

	var assignedAt *time.Time
	if partnerID != nil {
		now := time.Now()
		assignedAt = &now
	}
	if _, err := tx.Exec(ctx,
		`UPDATE orders SET delivery_partner_id=$3, delivery_assigned_at=$4, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
		orderID, tenantID, partnerID, assignedAt); err != nil {
		return err
	}
	if err := appendStatusEventLocked(ctx, tx, orderID, models.OrderStatusEvent{
		Status: status, Timestamp: time.Now(), Actor: actor, Note: note,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
