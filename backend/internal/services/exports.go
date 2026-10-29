package services

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/trucommerce/backend/internal/config"
	"github.com/trucommerce/backend/internal/email"
	"github.com/trucommerce/backend/internal/models"
)

// ---------------- Export job CRUD ----------------

// CreateExportJob inserts a new pending export job.
func (s *Store) CreateExportJob(ctx context.Context, tenantID, userID uuid.UUID, typ, format string, filters map[string]string, emailAddr string) (*models.ExportJob, error) {
	fb, _ := json.Marshal(filters)
	var job models.ExportJob
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO export_jobs (tenant_id, user_id, type, format, filters, email, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')
		RETURNING id, tenant_id, user_id, type, format, filters, email, status, file_path, file_name, file_size, rows_total, rows_done, error, created_at, started_at, completed_at`,
		tenantID, userID, typ, format, fb, emailAddr,
	).Scan(&job.ID, &job.TenantID, &job.UserID, &job.Type, &job.Format, &job.Filters, &job.Email, &job.Status,
		&job.FilePath, &job.FileName, &job.FileSize, &job.RowsTotal, &job.RowsDone, &job.Error,
		&job.CreatedAt, &job.StartedAt, &job.CompletedAt)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// GetExportJob fetches a single export job by ID (tenant-scoped).
func (s *Store) GetExportJob(ctx context.Context, tenantID, jobID uuid.UUID) (*models.ExportJob, error) {
	var job models.ExportJob
	var fb []byte
	err := s.Pool.QueryRow(ctx, `
		SELECT id, tenant_id, user_id, type, format, filters, email, status, file_path, file_name, file_size, rows_total, rows_done, error, created_at, started_at, completed_at
		FROM export_jobs WHERE id=$1 AND tenant_id=$2`,
		jobID, tenantID,
	).Scan(&job.ID, &job.TenantID, &job.UserID, &job.Type, &job.Format, &fb, &job.Email, &job.Status,
		&job.FilePath, &job.FileName, &job.FileSize, &job.RowsTotal, &job.RowsDone, &job.Error,
		&job.CreatedAt, &job.StartedAt, &job.CompletedAt)
	if err != nil {
		return nil, err
	}
	if fb != nil {
		_ = json.Unmarshal(fb, &job.Filters)
	}
	return &job, nil
}

// ListExportJobs lists export jobs for a tenant (most recent first).
func (s *Store) ListExportJobs(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]models.ExportJob, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM export_jobs WHERE tenant_id=$1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.Pool.Query(ctx, `
		SELECT id, tenant_id, user_id, type, format, filters, email, status, file_path, file_name, file_size, rows_total, rows_done, error, created_at, started_at, completed_at
		FROM export_jobs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var jobs []models.ExportJob
	for rows.Next() {
		var job models.ExportJob
		var fb []byte
		if err := rows.Scan(&job.ID, &job.TenantID, &job.UserID, &job.Type, &job.Format, &fb, &job.Email, &job.Status,
			&job.FilePath, &job.FileName, &job.FileSize, &job.RowsTotal, &job.RowsDone, &job.Error,
			&job.CreatedAt, &job.StartedAt, &job.CompletedAt); err != nil {
			return nil, 0, err
		}
		if fb != nil {
			_ = json.Unmarshal(fb, &job.Filters)
		}
		jobs = append(jobs, job)
	}
	return jobs, total, nil
}

// ClaimPendingExportJob atomically claims the oldest pending job, returning its ID and tenant ID (or uuid.Nil if none).
func (s *Store) ClaimPendingExportJob(ctx context.Context) (uuid.UUID, uuid.UUID, bool, error) {
	var id, tenantID uuid.UUID
	err := s.Pool.QueryRow(ctx, `
		UPDATE export_jobs SET status='running', started_at=now()
		WHERE id = (SELECT id FROM export_jobs WHERE status='pending' ORDER BY created_at ASC LIMIT 1)
		RETURNING id, tenant_id`,
	).Scan(&id, &tenantID)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return uuid.Nil, uuid.Nil, false, nil
		}
		return uuid.Nil, uuid.Nil, false, err
	}
	return id, tenantID, true, nil
}

// UpdateExportJobProgress updates rows_done and rows_total for a running job.
func (s *Store) UpdateExportJobProgress(ctx context.Context, jobID uuid.UUID, rowsDone, rowsTotal int) error {
	_, err := s.Pool.Exec(ctx, `UPDATE export_jobs SET rows_done=$2, rows_total=$3 WHERE id=$1`, jobID, rowsDone, rowsTotal)
	return err
}

// CompleteExportJob marks a job as completed with file metadata.
func (s *Store) CompleteExportJob(ctx context.Context, jobID uuid.UUID, filePath, fileName string, fileSize int64, rowsTotal int) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE export_jobs SET status='completed', file_path=$2, file_name=$3, file_size=$4, rows_total=$5, completed_at=now()
		WHERE id=$1`, jobID, filePath, fileName, fileSize, rowsTotal)
	return err
}

// FailExportJob marks a job as failed with an error message.
func (s *Store) FailExportJob(ctx context.Context, jobID uuid.UUID, errMsg string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE export_jobs SET status='failed', error=$2, completed_at=now() WHERE id=$1`, jobID, errMsg)
	return err
}

// ---------------- Export type registry ----------------

// ExportType defines a bulk export type with CSV headers and a batch fetcher.
type ExportType struct {
	Name        string
	Description string
	Headers     []string
	CountFn     func(ctx context.Context, s *Store, tenantID uuid.UUID, f map[string]string) (int, error)
	BatchFn     func(ctx context.Context, s *Store, tenantID uuid.UUID, f map[string]string, limit, offset int) ([][]string, error)
}

// ExportRegistry maps export type keys to their definitions.
var ExportRegistry = map[string]ExportType{
	"orders": {
		Name:        "Orders",
		Description: "All orders with status, totals, customer, and dates",
		Headers:     []string{"ID", "Status", "Subtotal", "Discount", "Shipping", "Tax", "Grand Total", "Currency", "Customer Email", "Payment Method", "Shipping Method", "Shipping Weight", "Created At", "Shipped At", "Delivered At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			_, total, err := s.ListOrdersFiltered(ctx, tid, buildOrderFilter(f), 1, 0)
			return total, err
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			orders, _, err := s.ListOrdersFiltered(ctx, tid, buildOrderFilter(f), limit, offset)
			if err != nil {
				return nil, err
			}
			rows := make([][]string, 0, len(orders))
			for _, o := range orders {
				rows = append(rows, []string{
					o.ID.String(), o.Status,
					fmt.Sprintf("%.2f", o.Subtotal), fmt.Sprintf("%.2f", o.DiscountTotal),
					fmt.Sprintf("%.2f", o.ShippingTotal), fmt.Sprintf("%.2f", o.TaxTotal),
					fmt.Sprintf("%.2f", o.GrandTotal), o.CurrencyCode,
					o.CustomerEmail, o.PaymentMethod, o.ShippingMethod,
					fmt.Sprintf("%.2f", o.ShippingWeight),
					o.CreatedAt.Format(time.RFC3339),
					ptrTimeStr(o.ShippedAt), ptrTimeStr(o.DeliveredAt),
				})
			}
			return rows, nil
		},
	},
	"products": {
		Name:        "Products",
		Description: "Product catalog with pricing, stock, and status",
		Headers:     []string{"ID", "Name", "Slug", "SKU", "Status", "Base Price", "Stock", "Weight", "Created At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			pf := buildProductFilter(tid, f)
			_, total, err := s.ListProducts(ctx, pf)
			return total, err
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			pf := buildProductFilter(tid, f)
			pf.Limit = limit
			pf.Offset = offset
			products, _, err := s.ListProducts(ctx, pf)
			if err != nil {
				return nil, err
			}
			rows := make([][]string, 0, len(products))
			for _, p := range products {
				rows = append(rows, []string{
					p.ID.String(), p.Name, p.Slug, p.SKU, p.Status,
					fmt.Sprintf("%.2f", p.BasePrice), fmt.Sprintf("%d", p.Stock),
					fmt.Sprintf("%.2f", p.Weight),
					p.CreatedAt.Format(time.RFC3339),
				})
			}
			return rows, nil
		},
	},
	"customers": {
		Name:        "Customers",
		Description: "Customer accounts with contact info and status",
		Headers:     []string{"ID", "Email", "Full Name", "Phone", "Active", "Marketing Consent", "Created At", "Last Login"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			cf := buildCustomerFilter(tid, f)
			cf.Limit = 1
			cf.Offset = 0
			_, total, err := s.ListCustomers(ctx, cf)
			return total, err
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			cf := buildCustomerFilter(tid, f)
			cf.Limit = limit
			cf.Offset = offset
			users, _, err := s.ListCustomers(ctx, cf)
			if err != nil {
				return nil, err
			}
			rows := make([][]string, 0, len(users))
			for _, u := range users {
				rows = append(rows, []string{
					u.ID.String(), u.Email, u.FullName, u.Phone,
					boolStr(u.IsActive), boolStr(u.MarketingConsent),
					u.CreatedAt.Format(time.RFC3339), ptrTimeStr(u.LastLoginAt),
				})
			}
			return rows, nil
		},
	},
	"transactions": {
		Name:        "Payment Transactions",
		Description: "Payment transactions with gateway, status, and amounts",
		Headers:     []string{"ID", "Order ID", "Gateway", "Gateway Txn ID", "Type", "Status", "Amount", "Currency", "Refunded", "Customer Email", "Customer Name", "Created At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			_, total, err := s.ListPaymentTransactionsFiltered(ctx, tid, buildPaymentTxnFilter(f), 1, 0)
			return total, err
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			txns, _, err := s.ListPaymentTransactionsFiltered(ctx, tid, buildPaymentTxnFilter(f), limit, offset)
			if err != nil {
				return nil, err
			}
			rows := make([][]string, 0, len(txns))
			for _, t := range txns {
				rows = append(rows, []string{
					t.ID.String(), t.OrderID.String(), t.Gateway, t.GatewayTxnID,
					t.Type, t.Status, fmt.Sprintf("%.2f", t.Amount), t.CurrencyCode,
					fmt.Sprintf("%.2f", t.RefundedAmount), t.CustomerEmail, t.CustomerName,
					t.CreatedAt.Format(time.RFC3339),
				})
			}
			return rows, nil
		},
	},
	"stock_movements": {
		Name:        "Stock Movements",
		Description: "Inventory movement history with type, quantity, and reason",
		Headers:     []string{"ID", "Product", "Variant", "Type", "Quantity", "Reason", "Reference", "Created At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			_, total, err := s.ListStockMovementsFiltered(ctx, tid, buildStockMovementFilter(f), 1, 0)
			return total, err
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			movs, _, err := s.ListStockMovementsFiltered(ctx, tid, buildStockMovementFilter(f), limit, offset)
			if err != nil {
				return nil, err
			}
			rows := make([][]string, 0, len(movs))
			for _, m := range movs {
				rows = append(rows, []string{
					m.ID.String(), m.ProductName, m.VariantName,
					m.MovementType, fmt.Sprintf("%d", m.Quantity), m.Reason, m.Reference,
					m.CreatedAt.Format(time.RFC3339),
				})
			}
			return rows, nil
		},
	},
	"wallet_transactions": {
		Name:        "Wallet Transactions",
		Description: "All wallet transactions across the tenant",
		Headers:     []string{"ID", "User ID", "Type", "Source", "Amount", "Balance After", "Currency", "Description", "Reference", "Created At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			_, total, err := s.ListAllWalletTransactionsFiltered(ctx, tid, buildWalletTxnFilter(f), 1, 0)
			return total, err
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			txns, _, err := s.ListAllWalletTransactionsFiltered(ctx, tid, buildWalletTxnFilter(f), limit, offset)
			if err != nil {
				return nil, err
			}
			rows := make([][]string, 0, len(txns))
			for _, t := range txns {
				rows = append(rows, []string{
					t.ID.String(), t.UserID.String(), t.Type, t.Source,
					fmt.Sprintf("%.2f", t.Amount), fmt.Sprintf("%.2f", t.BalanceAfter),
					t.CurrencyCode, t.Description, t.Reference,
					t.CreatedAt.Format(time.RFC3339),
				})
			}
			return rows, nil
		},
	},
	"returns": {
		Name:        "Returns",
		Description: "Return/replacement/exchange requests with status and amounts",
		Headers:     []string{"ID", "Return Number", "Order ID", "Type", "Status", "Reason", "Refund Amount", "Refund Method", "Customer Name", "Customer Email", "Created At", "Completed At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			_, total, err := s.ListOrderReturns(ctx, tid, buildReturnFilter(f), 1, 0)
			return total, err
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			rets, _, err := s.ListOrderReturns(ctx, tid, buildReturnFilter(f), limit, offset)
			if err != nil {
				return nil, err
			}
			rows := make([][]string, 0, len(rets))
			for _, r := range rets {
				rows = append(rows, []string{
					r.ID.String(), r.ReturnNumber, r.OrderID.String(),
					r.Type, r.Status, r.Reason,
					fmt.Sprintf("%.2f", r.RefundAmount), r.RefundMethod,
					r.CustomerName, r.CustomerEmail,
					r.CreatedAt.Format(time.RFC3339), ptrTimeStr(r.CompletedAt),
				})
			}
			return rows, nil
		},
	},
	"discounts": {
		Name:        "Discount Codes",
		Description: "All discount codes with usage and validity",
		Headers:     []string{"ID", "Code", "Description", "Type", "Value", "Min Subtotal", "Max Uses", "Used Count", "Active", "Starts At", "Ends At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			items, err := s.ListDiscountCodesScoped(ctx, tid, exportBranchID(f))
			if err != nil {
				return 0, err
			}
			return len(items), nil
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			items, err := s.ListDiscountCodesScoped(ctx, tid, exportBranchID(f))
			if err != nil {
				return nil, err
			}
			end := offset + limit
			if end > len(items) {
				end = len(items)
			}
			if offset > len(items) {
				return nil, nil
			}
			items = items[offset:end]
			rows := make([][]string, 0, len(items))
			for _, d := range items {
				maxUses := ""
				if d.MaxUses != nil {
					maxUses = fmt.Sprintf("%d", *d.MaxUses)
				}
				rows = append(rows, []string{
					d.ID.String(), d.Code, d.Description, d.DiscountType,
					fmt.Sprintf("%.2f", d.Value), fmt.Sprintf("%.2f", d.MinSubtotal),
					maxUses, fmt.Sprintf("%d", d.UsedCount), boolStr(d.IsActive),
					ptrTimeStr(d.StartsAt), ptrTimeStr(d.EndsAt),
				})
			}
			return rows, nil
		},
	},
	"offers": {
		Name:        "Offers",
		Description: "All promotional offers with type and validity",
		Headers:     []string{"ID", "Name", "Description", "Type", "Value", "Active", "Starts At", "Ends At"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			items, err := s.ListOffersScoped(ctx, tid, exportBranchID(f))
			if err != nil {
				return 0, err
			}
			return len(items), nil
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			items, err := s.ListOffersScoped(ctx, tid, exportBranchID(f))
			if err != nil {
				return nil, err
			}
			end := offset + limit
			if end > len(items) {
				end = len(items)
			}
			if offset > len(items) {
				return nil, nil
			}
			items = items[offset:end]
			rows := make([][]string, 0, len(items))
			for _, o := range items {
				rows = append(rows, []string{
					o.ID.String(), o.Name, o.Description, o.OfferType,
					fmt.Sprintf("%.2f", o.Value), boolStr(o.IsActive),
					ptrTimeStr(o.StartsAt), ptrTimeStr(o.EndsAt),
				})
			}
			return rows, nil
		},
	},
	"users": {
		Name:        "Users & Staff",
		Description: "All tenant users with roles and status",
		Headers:     []string{"ID", "Email", "Full Name", "Role", "Active", "Phone", "Created At", "Last Login"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			items, err := s.ListTenantUsers(ctx, tid, exportBranchID(f))
			if err != nil {
				return 0, err
			}
			return len(items), nil
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			items, err := s.ListTenantUsers(ctx, tid, exportBranchID(f))
			if err != nil {
				return nil, err
			}
			end := offset + limit
			if end > len(items) {
				end = len(items)
			}
			if offset > len(items) {
				return nil, nil
			}
			items = items[offset:end]
			rows := make([][]string, 0, len(items))
			for _, u := range items {
				rows = append(rows, []string{
					u.ID.String(), u.Email, u.FullName, string(u.Role),
					boolStr(u.IsActive), u.Phone,
					u.CreatedAt.Format(time.RFC3339), ptrTimeStr(u.LastLoginAt),
				})
			}
			return rows, nil
		},
	},
	"inventory": {
		Name:        "Inventory",
		Description: "Current stock levels for all products and variants",
		Headers:     []string{"Product", "Slug", "SKU", "Variant", "Stock", "Low Stock Threshold", "Track Inventory", "Low Stock", "Out of Stock"},
		CountFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) (int, error) {
			items, err := listInventoryForExport(ctx, s, tid, f)
			if err != nil {
				return 0, err
			}
			return len(items), nil
		},
		BatchFn: func(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string, limit, offset int) ([][]string, error) {
			items, err := listInventoryForExport(ctx, s, tid, f)
			if err != nil {
				return nil, err
			}
			end := offset + limit
			if end > len(items) {
				end = len(items)
			}
			if offset > len(items) {
				return nil, nil
			}
			items = items[offset:end]
			rows := make([][]string, 0, len(items))
			for _, i := range items {
				rows = append(rows, []string{
					i.ProductName, i.ProductSlug, i.SKU, i.VariantName,
					fmt.Sprintf("%d", i.Stock), fmt.Sprintf("%d", i.LowStockThreshold),
					boolStr(i.TrackInventory), boolStr(i.IsLowStock), boolStr(i.IsOutOfStock),
				})
			}
			return rows, nil
		},
	},
}

// listInventoryForExport returns branch-scoped inventory rows when the export
// filters carry a branch_id, otherwise the shared store-level inventory.
func listInventoryForExport(ctx context.Context, s *Store, tid uuid.UUID, f map[string]string) ([]models.InventoryItem, error) {
	if bid := exportBranchID(f); bid != nil {
		return s.ListBranchInventory(ctx, tid, *bid, "")
	}
	return s.ListInventory(ctx, tid, "")
}

// ListExportTypes returns the keys of all registered export types.
func ListExportTypes() []string {
	keys := make([]string, 0, len(ExportRegistry))
	for k := range ExportRegistry {
		keys = append(keys, k)
	}
	return keys
}

// ---------------- Filter builders ----------------

// exportBranchID parses the optional "branch_id" filter that scopes an export
// job to a single branch.
func exportBranchID(f map[string]string) *uuid.UUID {
	if v := f["branch_id"]; v != "" {
		if id, err := uuid.Parse(v); err == nil {
			return &id
		}
	}
	return nil
}

func buildOrderFilter(f map[string]string) OrderListFilter {
	return OrderListFilter{
		Status:   f["status"],
		Search:   f["search"],
		BranchID: exportBranchID(f),
		Dr:       DateRangeFilter{From: f["from"], To: f["to"]},
	}
}

func buildProductFilter(tid uuid.UUID, f map[string]string) ProductFilter {
	pf := ProductFilter{
		TenantID:   tid,
		Status:     f["status"],
		IncludeAll: true,
		BranchID:   exportBranchID(f),
	}
	if s := f["search"]; s != "" {
		pf.Search = &s
	}
	return pf
}

func buildCustomerFilter(tid uuid.UUID, f map[string]string) CustomerFilter {
	cf := CustomerFilter{TenantID: tid, BranchID: exportBranchID(f)}
	if s := f["search"]; s != "" {
		cf.Search = &s
	}
	if st := f["status"]; st != "" {
		active := st == "active"
		cf.IsActive = &active
	}
	return cf
}

func buildPaymentTxnFilter(f map[string]string) PaymentTxnFilter {
	return PaymentTxnFilter{
		Status:   f["status"],
		Gateway:  f["gateway"],
		Type:     f["type"],
		Search:   f["search"],
		BranchID: exportBranchID(f),
		Dr:       DateRangeFilter{From: f["from"], To: f["to"]},
	}
}

func buildStockMovementFilter(f map[string]string) StockMovementFilter {
	return StockMovementFilter{
		MovementType: f["movement_type"],
		BranchID:     exportBranchID(f),
		Search:       f["search"],
		Dr:           DateRangeFilter{From: f["from"], To: f["to"]},
	}
}

func buildWalletTxnFilter(f map[string]string) WalletTxnFilter {
	return WalletTxnFilter{
		Type:     f["type"],
		Source:   f["source"],
		Search:   f["search"],
		BranchID: exportBranchID(f),
		Dr:       DateRangeFilter{From: f["from"], To: f["to"]},
	}
}

func buildReturnFilter(f map[string]string) ReturnListFilter {
	return ReturnListFilter{
		Status:   f["status"],
		Type:     f["type"],
		Search:   f["search"],
		BranchID: exportBranchID(f),
		Dr:       DateRangeFilter{From: f["from"], To: f["to"]},
	}
}

// ---------------- CSV generation + worker ----------------

const exportBatchSize = 500

// RunExportJob processes a single export job: generates CSV, updates progress, sends email.
func (s *Store) RunExportJob(ctx context.Context, tenantID, jobID uuid.UUID, cfg *config.Config, emailH EmailResolver) {
	job, err := s.GetExportJob(ctx, tenantID, jobID)
	if err != nil {
		slog.Error("export: failed to load job", "job_id", jobID, "error", err)
		return
	}
	et, ok := ExportRegistry[job.Type]
	if !ok {
		_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("unknown export type: %s", job.Type))
		return
	}
	filters := toStringMap(job.Filters)

	// Get total count
	total, err := et.CountFn(ctx, s, job.TenantID, filters)
	if err != nil {
		_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("failed to count rows: %v", err))
		return
	}
	_ = s.UpdateExportJobProgress(ctx, jobID, 0, total)

	if total == 0 {
		// Still produce a header-only CSV
	}

	// Create output directory
	exportDir := filepath.Join("/app/uploads", "exports")
	if err := os.MkdirAll(exportDir, 0o755); err != nil {
		_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("failed to create export dir: %v", err))
		return
	}

	fileName := fmt.Sprintf("export_%s_%s.csv", job.Type, job.ID.String())
	filePath := filepath.Join(exportDir, fileName)
	f, err := os.Create(filePath)
	if err != nil {
		_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("failed to create file: %v", err))
		return
	}
	defer f.Close()

	w := csv.NewWriter(f)
	defer w.Flush()

	// Write headers
	if err := w.Write(et.Headers); err != nil {
		_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("failed to write headers: %v", err))
		return
	}

	// Stream batches
	rowsDone := 0
	for offset := 0; offset < total || (offset == 0 && rowsDone == 0); offset += exportBatchSize {
		batch, err := et.BatchFn(ctx, s, job.TenantID, filters, exportBatchSize, offset)
		if err != nil {
			_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("failed at offset %d: %v", offset, err))
			return
		}
		for _, row := range batch {
			if err := w.Write(row); err != nil {
				_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("failed to write row: %v", err))
				return
			}
		}
		w.Flush()
		rowsDone += len(batch)
		_ = s.UpdateExportJobProgress(ctx, jobID, rowsDone, total)
		if len(batch) < exportBatchSize {
			break
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		_ = s.FailExportJob(ctx, jobID, fmt.Sprintf("csv flush error: %v", err))
		return
	}

	// Get file size
	stat, err := f.Stat()
	size := int64(0)
	if err == nil {
		size = stat.Size()
	}

	relPath := filepath.Join("exports", fileName)
	_ = s.CompleteExportJob(ctx, jobID, relPath, fileName, size, rowsDone)

	// Send email if requested
	if job.Email != "" && emailH != nil {
		go s.sendExportEmail(job.Email, job.Type, fileName, relPath, cfg, emailH, job.TenantID)
	}
}

// EmailResolver abstracts resolving SMTP config without an HTTP context.
type EmailResolver interface {
	ResolveSMTPConfig(c *gin.Context, tid uuid.UUID) email.SMTPConfig
}

func (s *Store) sendExportEmail(to, exportType, fileName, relPath string, cfg *config.Config, emailH EmailResolver, tid uuid.UUID) {
	smtpCfg := emailH.ResolveSMTPConfig(nil, tid)
	if smtpCfg.Host == "" {
		slog.Warn("export: SMTP not configured, skipping email", "to", to)
		return
	}
	downloadURL := fmt.Sprintf("%s/api/exports/download/%s", cfg.AppBaseURL, filepath.Base(relPath))
	subject := fmt.Sprintf("Your %s export is ready", exportType)
	body := fmt.Sprintf(`<html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
<h2>Your export is ready</h2>
<p>Your <strong>%s</strong> export has been completed successfully.</p>
<p>File: <code>%s</code></p>
<p style="margin-top: 20px;">
  <a href="%s" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Download CSV</a>
</p>
<p style="color: #666; font-size: 12px; margin-top: 20px;">This link requires authentication. If you did not request this export, you can ignore this email.</p>
</body></html>`, exportType, fileName, downloadURL)
	if err := email.SendEmail(smtpCfg, email.Email{To: []string{to}, Subject: subject, Body: body}); err != nil {
		slog.Error("export: failed to send email", "to", to, "error", err)
	}
}

// StartExportWorker runs a background loop that polls for pending export jobs and processes them.
func (s *Store) StartExportWorker(ctx context.Context, cfg *config.Config, emailH EmailResolver) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			jobID, tenantID, ok, err := s.ClaimPendingExportJob(ctx)
			if err != nil {
				slog.Error("export worker: claim error", "error", err)
				continue
			}
			if !ok {
				continue
			}
			slog.Info("export worker: processing job", "job_id", jobID)
			s.RunExportJob(ctx, tenantID, jobID, cfg, emailH)
		}
	}
}

// ---------------- Helpers ----------------

func ptrTimeStr(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format(time.RFC3339)
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// toStringMap converts a map[string]any (from JSONB) to map[string]string.
func toStringMap(m map[string]any) map[string]string {
	out := make(map[string]string, len(m))
	for k, v := range m {
		switch val := v.(type) {
		case string:
			out[k] = val
		case float64:
			out[k] = fmt.Sprintf("%v", val)
		case bool:
			if val {
				out[k] = "true"
			} else {
				out[k] = "false"
			}
		default:
			out[k] = fmt.Sprintf("%v", val)
		}
	}
	return out
}

// roundTo2 rounds a float64 to 2 decimal places (used for display).
func roundTo2(v float64) float64 {
	return math.Round(v*100) / 100
}
