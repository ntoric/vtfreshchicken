import { useQuery, useQueries } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ShoppingCart, CreditCard, Package, TrendingUp, Users,
  Receipt, Truck, Boxes, ArrowLeftRight, UserCog, Wallet,
  ArrowLeftRight as Transactions, Percent, Tag, MapPin, ArrowLeft,
  Download,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Spinner } from "@/components/Skeletons";
import { ReportFilters, type ReportFiltersValue } from "@/components/ReportFilters";
import { ExportDialog } from "@/components/ExportDialog";

// ===== Report registry =====
interface ReportMeta {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

const REPORTS: ReportMeta[] = [
  { key: "orders", title: "Orders Report", description: "Order counts by status, revenue, recent orders", icon: ShoppingCart, color: "bg-blue-50 text-blue-600" },
  { key: "payments", title: "Payments Report", description: "Collected, refunded, net revenue by gateway", icon: CreditCard, color: "bg-emerald-50 text-emerald-600" },
  { key: "products", title: "Products Report", description: "Product catalog overview and inventory", icon: Package, color: "bg-red-50 text-red-600" },
  { key: "sales", title: "Sales Report", description: "Revenue, order trends, top products", icon: TrendingUp, color: "bg-amber-50 text-amber-600" },
  { key: "customers", title: "Customers Report", description: "Customer stats, acquisition, spend", icon: Users, color: "bg-pink-50 text-pink-600" },
  { key: "taxes", title: "Taxes Report", description: "Tax classes, zones, and rates", icon: Receipt, color: "bg-cyan-50 text-cyan-600" },
  { key: "shipping", title: "Shipping Report", description: "Methods, zones, and rates", icon: Truck, color: "bg-orange-50 text-orange-600" },
  { key: "inventory", title: "Inventory Report", description: "Stock levels, low stock, stock value", icon: Boxes, color: "bg-teal-50 text-teal-600" },
  { key: "stock", title: "Stock Movements", description: "Stock movement history and reasons", icon: ArrowLeftRight, color: "bg-lime-50 text-lime-600" },
  { key: "users", title: "Users & Staff Report", description: "User roles, active/inactive counts", icon: UserCog, color: "bg-neutral-50 text-neutral-600" },
  { key: "wallet", title: "Wallet Report", description: "Wallet balances, topups, purchases", icon: Wallet, color: "bg-violet-50 text-violet-600" },
  { key: "transactions", title: "Transactions Report", description: "Payment transactions across gateways", icon: Transactions, color: "bg-rose-50 text-rose-600" },
  { key: "discounts", title: "Discounts Report", description: "Discount codes, redemptions, savings", icon: Percent, color: "bg-fuchsia-50 text-fuchsia-600" },
  { key: "offers", title: "Offers Report", description: "Active offers and targeting", icon: Tag, color: "bg-sky-50 text-sky-600" },
  { key: "addresses", title: "Addresses Report", description: "Customer addresses overview", icon: MapPin, color: "bg-green-50 text-green-600" },
];

// ===== Landing page =====
export function Reports() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Reports" subtitle="Browse and export detailed reports across your store" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              onClick={() => navigate(`/reports/${r.key}`)}
              className="bg-white rounded-2xl border p-5 text-left hover:shadow-md hover:border-brand/40 transition group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${r.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-1 group-hover:text-brand transition">{r.title}</h3>
              <p className="text-sm text-neutral-500">{r.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ===== Report router =====
// Maps report keys to their export type (only reports with a matching export type show the export button).
const EXPORT_TYPE_MAP: Record<string, string> = {
  orders: "orders",
  payments: "transactions",
  products: "products",
  sales: "orders",
  customers: "customers",
  inventory: "inventory",
  stock: "stock_movements",
  users: "users",
  wallet: "wallet_transactions",
  transactions: "transactions",
  discounts: "discounts",
  offers: "offers",
};

export function ReportDetail() {
  const { type } = useParams<{ type: string }>();
  const meta = REPORTS.find((r) => r.key === type);
  const [exportOpen, setExportOpen] = useState(false);
  const exportType = type ? EXPORT_TYPE_MAP[type] : undefined;

  if (!meta) {
    return (
      <div>
        <PageHeader title="Report not found" />
        <p className="text-sm text-neutral-500">The report you requested does not exist.</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => history.back()}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Reports
      </button>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={meta.title} subtitle={meta.description} />
        {exportType && (
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition flex-shrink-0"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>
      <ReportContent type={meta.key} />
      {exportType && (
        <ExportDialog
          open={exportOpen}
          type={exportType}
          title={meta.title}
          filters={{}}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

function ReportContent({ type }: { type: string }) {
  switch (type) {
    case "orders": return <OrdersReport />;
    case "payments": return <PaymentsReport />;
    case "products": return <ProductsReport />;
    case "sales": return <SalesReport />;
    case "customers": return <CustomersReport />;
    case "taxes": return <TaxesReport />;
    case "shipping": return <ShippingReport />;
    case "inventory": return <InventoryReport />;
    case "stock": return <StockReport />;
    case "users": return <UsersReport />;
    case "wallet": return <WalletReport />;
    case "transactions": return <TransactionsReport />;
    case "discounts": return <DiscountsReport />;
    case "offers": return <OffersReport />;
    case "addresses": return <AddressesReport />;
    default: return null;
  }
}

// ===== Shared helpers =====
function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-neutral-400">
      <Spinner size={28} className="text-brand" />
      <span className="ml-3 text-sm">Loading report…</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="bg-rose-50 text-rose-600 rounded-xl p-4 text-sm">{message}</div>;
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-neutral-400 py-8 text-center">{label}</p>;
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) return <EmptyState label="No records found." />;
  return (
    <div className="bg-white rounded-2xl border overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-500 text-left">
          <tr>
            {headers.map((h, i) => <th key={i} className="px-4 py-3 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-neutral-50">
              {row.map((cell, ci) => <td key={ci} className="px-4 py-3 text-neutral-700">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== Orders Report =====
function OrdersReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const q = useQuery({
    queryKey: ["r-orders", tenant, filters.from, filters.to],
    queryFn: () => api.dashboardStats(tenant, filters.from, filters.to),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load orders report." />;
  const s = q.data!
  const statusCounts = s.orders_by_status || {};
  return (
    <div className="space-y-6">
      <ReportFilters value={filters} onChange={setFilters} dateRange />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Orders" value={s.orders ?? 0} icon={<ShoppingCart className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Total Revenue" value={money(s.revenue ?? 0)} icon={<TrendingUp className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Products Sold" value={s.products ?? 0} icon={<Package className="w-6 h-6" />} color="bg-red-50 text-red-600" />
      </div>
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Orders by Status</h3>
        {Object.keys(statusCounts).length === 0 ? (
          <EmptyState label="No orders in this period." />
        ) : (
          <div className="space-y-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm capitalize text-neutral-600">{status}</span>
                <span className="font-semibold text-neutral-900">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Recent Orders</h3>
        <Table
          headers={["Order ID", "Status", "Total", "Date"]}
          rows={(s.recent_orders || []).map((o) => [
            <span className="font-mono text-xs">{o.id.slice(0, 8)}</span>,
            <span className="capitalize">{o.status}</span>,
            <span className="font-semibold">{money(o.total, o.currency)}</span>,
            <span className="text-neutral-500">{new Date(o.created_at).toLocaleDateString()}</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Payments Report =====
function PaymentsReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const q = useQuery({
    queryKey: ["r-payments", tenant, filters.from, filters.to],
    queryFn: () => api.paymentStats(tenant, filters.from, filters.to),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load payments report." />;
  const s = q.data!
  return (
    <div className="space-y-6">
      <ReportFilters value={filters} onChange={setFilters} dateRange />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Total Collected" value={money(s.total_collected)} icon={<CreditCard className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total Refunded" value={money(s.total_refunded)} icon={<ArrowLeftRight className="w-6 h-6" />} color="bg-rose-50 text-rose-600" />
        <StatCard label="Net Revenue" value={money(s.net_revenue)} icon={<TrendingUp className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Transactions" value={s.transaction_count ?? 0} icon={<Receipt className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Refunds" value={s.refund_count ?? 0} icon={<ArrowLeftRight className="w-6 h-6" />} color="bg-rose-50 text-rose-600" />
        <StatCard label="Pending" value={s.pending_count ?? 0} icon={<Receipt className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
        <StatCard label="Failed" value={s.failed_count ?? 0} icon={<Receipt className="w-6 h-6" />} color="bg-neutral-50 text-neutral-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">By Gateway</h3>
        <Table
          headers={["Gateway", "Transactions", "Total Amount", "Refunded"]}
          rows={(s.by_gateway || []).map((g) => [
            <span className="capitalize font-medium">{g.gateway}</span>,
            g.count,
            money(g.total_amount),
            money(g.refunded_amount),
          ])}
        />
      </div>
    </div>
  );
}


// ===== Products Report =====
function ProductsReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const q = useQuery({
    queryKey: ["r-products", tenant, filters.search, filters.status],
    queryFn: () => api.listProductsAdmin(tenant, { search: filters.search, status: filters.status }),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load products report." />;
  const items = q.data?.items || [];
  const active = items.filter((p) => p.status === "active" || p.status === "published").length;
  const inactive = items.length - active;
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        search
        searchPlaceholder="Search products…"
        selects={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ] },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Products" value={items.length} icon={<Package className="w-6 h-6" />} color="bg-red-50 text-red-600" />
        <StatCard label="Active" value={active} icon={<Package className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Inactive" value={inactive} icon={<Package className="w-6 h-6" />} color="bg-neutral-50 text-neutral-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Product Catalog</h3>
        <Table
          headers={["Name", "Slug", "Status", "Price"]}
          rows={items.slice(0, 50).map((p) => [
            p.name,
            <span className="font-mono text-xs">{p.slug}</span>,
            <span className="capitalize">{p.status}</span>,
            <span className="font-semibold">{money(p.base_price, p.currency_code)}</span>,
          ])}
        />
        {items.length > 50 && <p className="text-xs text-neutral-400 mt-2">Showing first 50 of {items.length} products.</p>}
      </div>
    </div>
  );
}

// ===== Sales Report =====
function SalesReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const q = useQuery({
    queryKey: ["r-sales", tenant, filters.from, filters.to],
    queryFn: () => api.dashboardStats(tenant, filters.from, filters.to),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load sales report." />;
  const s = q.data!
  const statusCounts = s.orders_by_status || {};
  const completed = statusCounts.completed || statusCounts.delivered || statusCounts.paid || 0;
  return (
    <div className="space-y-6">
      <ReportFilters value={filters} onChange={setFilters} dateRange />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Revenue" value={money(s.revenue ?? 0)} icon={<TrendingUp className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total Orders" value={s.orders ?? 0} icon={<ShoppingCart className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Completed Orders" value={completed} icon={<Receipt className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
      </div>
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Sales by Order Status</h3>
        <div className="space-y-3">
          {Object.keys(statusCounts).length === 0 ? (
            <EmptyState label="No sales data in this period." />
          ) : (
            Object.entries(statusCounts).map(([status, count]) => {
              const pct = s.orders > 0 ? Math.round((count / s.orders) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm capitalize text-neutral-600">{status}</span>
                    <span className="text-sm font-semibold text-neutral-900">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2">
                    <div className="bg-brand h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Recent Sales</h3>
        <Table
          headers={["Order ID", "Status", "Total", "Date"]}
          rows={(s.recent_orders || []).map((o) => [
            <span className="font-mono text-xs">{o.id.slice(0, 8)}</span>,
            <span className="capitalize">{o.status}</span>,
            <span className="font-semibold">{money(o.total, o.currency)}</span>,
            <span className="text-neutral-500">{new Date(o.created_at).toLocaleDateString()}</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Customers Report =====
function CustomersReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const statsQ = useQuery({
    queryKey: ["r-cust-stats", tenant, filters.from, filters.to],
    queryFn: () => api.customerStats(tenant, filters.from, filters.to),
  });
  const listQ = useQuery({ queryKey: ["r-cust-list", tenant], queryFn: () => api.listCustomers(tenant, undefined, undefined, 50, 0) });
  if (statsQ.isLoading || listQ.isLoading) return <Loading />;
  if (statsQ.error) return <ErrorBox message="Failed to load customers report." />;
  const s = statsQ.data!
  return (
    <div className="space-y-6">
      <ReportFilters value={filters} onChange={setFilters} dateRange />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Total Customers" value={s.total_customers} icon={<Users className="w-6 h-6" />} color="bg-pink-50 text-pink-600" />
        <StatCard label="Active" value={s.active_customers} icon={<Users className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="New This Month" value={s.new_this_month} icon={<Users className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Total Spent" value={money(s.total_spent)} icon={<Wallet className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
      </div>
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-neutral-900 mb-2">Average Order Value</h3>
        <p className="text-3xl font-bold text-neutral-900">{money(s.avg_order_value)}</p>
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Recent Customers</h3>
        <Table
          headers={["Name", "Email", "Status"]}
          rows={(listQ.data?.items || []).map((c) => [
            c.full_name || "—",
            c.email,
            c.is_active ? <span className="text-emerald-600">Active</span> : <span className="text-neutral-400">Inactive</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Taxes Report =====
function TaxesReport() {
  const { tenant } = useAuth();
  const classesQ = useQuery({ queryKey: ["r-tax-classes", tenant], queryFn: () => api.listTaxClasses(tenant) });
  const zonesQ = useQuery({ queryKey: ["r-tax-zones", tenant], queryFn: () => api.listTaxZones(tenant) });
  const ratesQ = useQuery({ queryKey: ["r-tax-rates", tenant], queryFn: () => api.listTaxRates(tenant) });
  if (classesQ.isLoading || zonesQ.isLoading || ratesQ.isLoading) return <Loading />;
  if (classesQ.error) return <ErrorBox message="Failed to load taxes report." />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Tax Classes" value={classesQ.data?.items?.length ?? 0} icon={<Receipt className="w-6 h-6" />} color="bg-cyan-50 text-cyan-600" />
        <StatCard label="Tax Zones" value={zonesQ.data?.items?.length ?? 0} icon={<MapPin className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Tax Rates" value={ratesQ.data?.items?.length ?? 0} icon={<Percent className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Tax Rates</h3>
        <Table
          headers={["Name", "Rate (%)", "Class", "Zone"]}
          rows={(ratesQ.data?.items || []).map((r) => [
            r.name,
            <span className="font-semibold">{r.rate}%</span>,
            (r as any).tax_class_name || "—",
            (r as any).tax_zone_name || "—",
          ])}
        />
      </div>
    </div>
  );
}

// ===== Shipping Report =====
function ShippingReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const methodsQ = useQuery({ queryKey: ["r-ship-methods", tenant], queryFn: () => api.listShippingMethods(tenant) });
  const zonesQ = useQuery({ queryKey: ["r-ship-zones", tenant], queryFn: () => api.listShippingZones(tenant) });
  const ratesQ = useQuery({ queryKey: ["r-ship-rates", tenant], queryFn: () => api.listShippingRates(tenant) });
  if (methodsQ.isLoading || zonesQ.isLoading || ratesQ.isLoading) return <Loading />;
  if (methodsQ.error) return <ErrorBox message="Failed to load shipping report." />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Shipping Methods" value={methodsQ.data?.items?.length ?? 0} icon={<Truck className="w-6 h-6" />} color="bg-orange-50 text-orange-600" />
        <StatCard label="Shipping Zones" value={zonesQ.data?.items?.length ?? 0} icon={<MapPin className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Shipping Rates" value={ratesQ.data?.items?.length ?? 0} icon={<Receipt className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Shipping Rates</h3>
        <Table
          headers={["Method", "Zone", "Rate", "Active"]}
          rows={(ratesQ.data?.items || []).map((r) => [
            r.shipping_method_name || r.id.slice(0, 8),
            r.shipping_zone_name || "—",
            <span className="font-semibold">{money(r.rate)}</span>,
            r.is_active ? <span className="text-emerald-600">Yes</span> : <span className="text-neutral-400">No</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Inventory Report =====
function InventoryReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const statsQ = useQuery({ queryKey: ["r-inv-stats", tenant], queryFn: () => api.inventoryStats(tenant) });
  const itemsQ = useQuery({ queryKey: ["r-inv-list", tenant], queryFn: () => api.listInventory(tenant) });
  if (statsQ.isLoading || itemsQ.isLoading) return <Loading />;
  if (statsQ.error) return <ErrorBox message="Failed to load inventory report." />;
  const s = statsQ.data!
  const allItems = itemsQ.data?.items || [];
  // Client-side filtering on top of the loaded inventory
  const filtered = allItems.filter((i) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!i.product_name?.toLowerCase().includes(q) && !i.sku?.toLowerCase().includes(q)) return false;
    }
    if (filters.stock_state === "in_stock" && (i.is_out_of_stock || i.is_low_stock)) return false;
    if (filters.stock_state === "low_stock" && (i.is_out_of_stock || !i.is_low_stock)) return false;
    if (filters.stock_state === "out_of_stock" && !i.is_out_of_stock) return false;
    return true;
  });
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        search
        searchPlaceholder="Search product, SKU…"
        selects={[
          { key: "stock_state", label: "Stock state", options: [
            { value: "in_stock", label: "In stock" },
            { value: "low_stock", label: "Low stock" },
            { value: "out_of_stock", label: "Out of stock" },
          ] },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Total SKUs" value={s.total_skus} icon={<Boxes className="w-6 h-6" />} color="bg-teal-50 text-teal-600" />
        <StatCard label="In Stock" value={s.in_stock} icon={<Boxes className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Low Stock" value={s.low_stock} icon={<Boxes className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
        <StatCard label="Out of Stock" value={s.out_of_stock} icon={<Boxes className="w-6 h-6" />} color="bg-rose-50 text-rose-600" />
      </div>
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-neutral-900 mb-2">Total Stock Value</h3>
        <p className="text-3xl font-bold text-neutral-900">{money(s.total_stock_value)}</p>
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Inventory Items</h3>
        <Table
          headers={["Product", "SKU", "Stock", "Status"]}
          rows={filtered.slice(0, 50).map((i) => [
            i.product_name,
            <span className="font-mono text-xs">{i.sku}</span>,
            <span className="font-semibold">{i.stock}</span>,
            i.is_out_of_stock ? <span className="text-rose-600">Out of stock</span>
              : i.is_low_stock ? <span className="text-amber-600">Low</span>
              : <span className="text-emerald-600">In stock</span>,
          ])}
        />
        {filtered.length > 50 && <p className="text-xs text-neutral-400 mt-2">Showing first 50 of {filtered.length} items.</p>}
      </div>
    </div>
  );
}

// ===== Stock Movements Report =====
function StockReport() {
  const { tenant } = useAuth();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const q = useQuery({
    queryKey: ["r-stock", tenant, filters.from, filters.to, filters.movement_type, filters.search],
    queryFn: () => api.listStockMovements(tenant, {
      limit: 50, offset: 0,
      movement_type: filters.movement_type,
      search: filters.search,
      from: filters.from,
      to: filters.to,
    }),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load stock movements report." />;
  const items = q.data?.items || [];
  const inbound = items.filter((m) => m.quantity > 0).reduce((sum, m) => sum + m.quantity, 0);
  const outbound = items.filter((m) => m.quantity < 0).reduce((sum, m) => sum + Math.abs(m.quantity), 0);
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        dateRange
        search
        searchPlaceholder="Search product, SKU, reason…"
        selects={[
          { key: "movement_type", label: "Movement type", options: [
            { value: "purchase", label: "Purchase" },
            { value: "adjustment", label: "Adjustment" },
            { value: "sale", label: "Sale" },
            { value: "return", label: "Return" },
            { value: "transfer", label: "Transfer" },
          ] },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Movements" value={q.data?.total ?? items.length} icon={<ArrowLeftRight className="w-6 h-6" />} color="bg-lime-50 text-lime-600" />
        <StatCard label="Units In" value={inbound} icon={<ArrowLeftRight className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Units Out" value={outbound} icon={<ArrowLeftRight className="w-6 h-6" />} color="bg-rose-50 text-rose-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Recent Stock Movements</h3>
        <Table
          headers={["Product", "Type", "Quantity", "Reason", "Date"]}
          rows={items.map((m) => [
            m.product_name,
            <span className="capitalize">{m.movement_type}</span>,
            <span className={m.quantity >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
              {m.quantity > 0 ? "+" : ""}{m.quantity}
            </span>,
            m.reason || "—",
            <span className="text-neutral-500">{new Date(m.created_at).toLocaleString()}</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Users Report =====
function UsersReport() {
  const { tenant } = useAuth();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const statsQ = useQuery({ queryKey: ["r-users-stats", tenant], queryFn: () => api.userStats(tenant) });
  const listQ = useQuery({ queryKey: ["r-users-list", tenant], queryFn: () => api.listUsers(tenant) });
  if (statsQ.isLoading || listQ.isLoading) return <Loading />;
  if (statsQ.error) return <ErrorBox message="Failed to load users report." />;
  const s = statsQ.data!
  const allItems = listQ.data?.items || [];
  const filtered = allItems.filter((u) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!u.email?.toLowerCase().includes(q) && !u.full_name?.toLowerCase().includes(q)) return false;
    }
    if (filters.role && u.role !== filters.role) return false;
    if (filters.status === "active" && !u.is_active) return false;
    if (filters.status === "inactive" && u.is_active) return false;
    return true;
  });
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        search
        searchPlaceholder="Search name, email…"
        selects={[
          { key: "role", label: "Role", options: [
            { value: "customer", label: "Customer" },
            { value: "staff", label: "Staff" },
            { value: "business_admin", label: "Business admin" },
            { value: "superadmin", label: "Superadmin" },
          ] },
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ] },
        ]}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        <StatCard label="Total" value={s.total} icon={<UserCog className="w-6 h-6" />} color="bg-neutral-50 text-neutral-600" />
        <StatCard label="Customers" value={s.customers} icon={<Users className="w-6 h-6" />} color="bg-pink-50 text-pink-600" />
        <StatCard label="Staff" value={s.staff} icon={<UserCog className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Admins" value={s.admins} icon={<UserCog className="w-6 h-6" />} color="bg-purple-50 text-purple-600" />
        <StatCard label="Active" value={s.active} icon={<Users className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Inactive" value={s.inactive} icon={<Users className="w-6 h-6" />} color="bg-rose-50 text-rose-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Users & Staff</h3>
        <Table
          headers={["Name", "Email", "Role", "Status"]}
          rows={filtered.map((u) => [
            u.full_name || "—",
            u.email,
            <span className="capitalize">{u.role.replace("_", " ")}</span>,
            u.is_active ? <span className="text-emerald-600">Active</span> : <span className="text-neutral-400">Inactive</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Wallet Report =====
function WalletReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const statsQ = useQuery({ queryKey: ["r-wallet-stats", tenant], queryFn: () => api.walletStats(tenant) });
  const txnsQ = useQuery({
    queryKey: ["r-wallet-txns", tenant, filters.from, filters.to, filters.type, filters.source, filters.search],
    queryFn: () => api.walletAllTransactions(tenant, {
      limit: 50, offset: 0,
      type: filters.type,
      source: filters.source,
      search: filters.search,
      from: filters.from,
      to: filters.to,
    }),
  });
  if (statsQ.isLoading || txnsQ.isLoading) return <Loading />;
  if (statsQ.error) return <ErrorBox message="Failed to load wallet report." />;
  const s = statsQ.data!
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        dateRange
        search
        searchPlaceholder="Search description, reference…"
        selects={[
          { key: "type", label: "Type", options: [
            { value: "credit", label: "Credit" },
            { value: "debit", label: "Debit" },
          ] },
          { key: "source", label: "Source", options: [
            { value: "topup", label: "Top-up" },
            { value: "purchase", label: "Purchase" },
            { value: "refund", label: "Refund" },
            { value: "adjustment", label: "Adjustment" },
            { value: "cashback", label: "Cashback" },
          ] },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Wallets" value={s.wallet_count} icon={<Wallet className="w-6 h-6" />} color="bg-violet-50 text-violet-600" />
        <StatCard label="Total Balance" value={money(s.total_balance)} icon={<Wallet className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total Topups" value={money(s.total_topups)} icon={<TrendingUp className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Total Purchases" value={money(s.total_purchases)} icon={<CreditCard className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Recent Wallet Transactions</h3>
        <Table
          headers={["User", "Type", "Source", "Amount", "Date"]}
          rows={(txnsQ.data?.items || []).map((t) => [
            <span className="font-mono text-xs">{t.user_id?.slice(0, 8) || "—"}</span>,
            <span className="capitalize">{t.type}</span>,
            <span className="capitalize">{t.source}</span>,
            <span className={`font-semibold ${t.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
              {t.type === "credit" ? "+" : "-"}{money(t.amount, t.currency_code)}
            </span>,
            <span className="text-neutral-500">{new Date(t.created_at).toLocaleString()}</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Transactions Report =====
function TransactionsReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const q = useQuery({
    queryKey: ["r-txns", tenant, filters.from, filters.to, filters.status, filters.gateway, filters.type, filters.search],
    queryFn: () => api.listPaymentTransactions(tenant, {
      limit: 50, offset: 0,
      status: filters.status,
      gateway: filters.gateway,
      type: filters.type,
      search: filters.search,
      from: filters.from,
      to: filters.to,
    }),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load transactions report." />;
  const items = q.data?.items || [];
  const total = items.reduce((sum, t) => sum + (t.amount || 0), 0);
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        dateRange
        search
        searchPlaceholder="Search txn ID, email, name…"
        selects={[
          { key: "status", label: "Status", options: [
            { value: "pending", label: "Pending" },
            { value: "success", label: "Success" },
            { value: "failed", label: "Failed" },
            { value: "captured", label: "Captured" },
          ] },
          { key: "type", label: "Type", options: [
            { value: "capture", label: "Capture" },
            { value: "refund", label: "Refund" },
            { value: "authorization", label: "Authorization" },
          ] },
          { key: "gateway", label: "Gateway", options: [
            { value: "razorpay", label: "Razorpay" },
            { value: "stripe", label: "Stripe" },
            { value: "mock", label: "Mock" },
            { value: "wallet", label: "Wallet" },
          ] },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Transactions" value={q.data?.total ?? items.length} icon={<Transactions className="w-6 h-6" />} color="bg-rose-50 text-rose-600" />
        <StatCard label="Total Amount" value={money(total)} icon={<CreditCard className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Avg Transaction" value={items.length ? money(total / items.length) : money(0)} icon={<Receipt className="w-6 h-6" />} color="bg-amber-50 text-amber-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Payment Transactions</h3>
        <Table
          headers={["ID", "Gateway", "Amount", "Status", "Date"]}
          rows={items.map((t) => [
            <span className="font-mono text-xs">{t.id.slice(0, 8)}</span>,
            <span className="capitalize">{t.gateway}</span>,
            <span className="font-semibold">{money(t.amount, t.currency_code)}</span>,
            <span className={`capitalize ${t.status === "succeeded" || t.status === "captured" || t.status === "success" ? "text-emerald-600" : t.status === "failed" ? "text-rose-600" : "text-amber-600"}`}>{t.status}</span>,
            <span className="text-neutral-500">{new Date(t.created_at).toLocaleString()}</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Discounts Report =====
function DiscountsReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const statsQ = useQuery({ queryKey: ["r-disc-stats", tenant], queryFn: () => api.discountStats(tenant) });
  const listQ = useQuery({ queryKey: ["r-disc-list", tenant], queryFn: () => api.listDiscounts(tenant) });
  if (statsQ.isLoading || listQ.isLoading) return <Loading />;
  if (statsQ.error) return <ErrorBox message="Failed to load discounts report." />;
  const s = statsQ.data!
  const allItems = listQ.data?.items || [];
  const filtered = allItems.filter((d) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!d.code?.toLowerCase().includes(q)) return false;
    }
    if (filters.status === "active" && !d.is_active) return false;
    if (filters.status === "inactive" && d.is_active) return false;
    if (filters.type && d.discount_type !== filters.type) return false;
    return true;
  });
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        search
        searchPlaceholder="Search discount code…"
        selects={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ] },
          { key: "type", label: "Type", options: [
            { value: "percentage", label: "Percentage" },
            { value: "fixed", label: "Fixed" },
          ] },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Total Codes" value={s.total_codes} icon={<Percent className="w-6 h-6" />} color="bg-fuchsia-50 text-fuchsia-600" />
        <StatCard label="Active Codes" value={s.active_codes} icon={<Percent className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Total Redemptions" value={s.total_redemptions} icon={<Tag className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Total Discount" value={money(s.total_discount)} icon={<TrendingUp className="w-6 h-6" />} color="bg-rose-50 text-rose-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Discount Codes</h3>
        <Table
          headers={["Code", "Type", "Value", "Active", "Uses"]}
          rows={filtered.map((d) => [
            <span className="font-mono font-semibold">{d.code}</span>,
            <span className="capitalize">{d.discount_type}</span>,
            d.discount_type === "percentage" ? `${d.value}%` : money(d.value),
            d.is_active ? <span className="text-emerald-600">Yes</span> : <span className="text-neutral-400">No</span>,
            <span className="font-semibold">{d.used_count} / {d.max_uses || "∞"}</span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Offers Report =====
function OffersReport() {
  const { tenant } = useAuth();
  const { formatMoney: money } = useCurrency();
  const [filters, setFilters] = useState<ReportFiltersValue>({});
  const q = useQuery({ queryKey: ["r-offers", tenant], queryFn: () => api.listOffers(tenant) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load offers report." />;
  const allItems = q.data?.items || [];
  const filtered = allItems.filter((o) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!o.name?.toLowerCase().includes(s)) return false;
    }
    if (filters.status === "active" && !o.is_active) return false;
    if (filters.status === "inactive" && o.is_active) return false;
    if (filters.type && o.offer_type !== filters.type) return false;
    return true;
  });
  const active = filtered.filter((o) => o.is_active).length;
  return (
    <div className="space-y-6">
      <ReportFilters
        value={filters}
        onChange={setFilters}
        search
        searchPlaceholder="Search offers…"
        selects={[
          { key: "status", label: "Status", options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ] },
          { key: "type", label: "Type", options: [
            { value: "percentage", label: "Percentage" },
            { value: "fixed", label: "Fixed" },
          ] },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total Offers" value={filtered.length} icon={<Tag className="w-6 h-6" />} color="bg-sky-50 text-sky-600" />
        <StatCard label="Active" value={active} icon={<Tag className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Inactive" value={filtered.length - active} icon={<Tag className="w-6 h-6" />} color="bg-neutral-50 text-neutral-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Offers</h3>
        <Table
          headers={["Name", "Type", "Value", "Target", "Active", "Window"]}
          rows={filtered.map((o) => [
            o.name,
            <span className="capitalize">{o.offer_type}</span>,
            o.offer_type === "percentage" ? `${o.value}%` : money(o.value),
            <span className="capitalize">{o.targets?.[0]?.target_type || "all"}</span>,
            o.is_active ? <span className="text-emerald-600">Yes</span> : <span className="text-neutral-400">No</span>,
            <span className="text-xs text-neutral-500">
              {o.starts_at ? new Date(o.starts_at).toLocaleDateString() : "—"} → {o.ends_at ? new Date(o.ends_at).toLocaleDateString() : "—"}
            </span>,
          ])}
        />
      </div>
    </div>
  );
}

// ===== Addresses Report =====
function AddressesReport() {
  const { tenant } = useAuth();
  const q = useQuery({ queryKey: ["r-addr", tenant], queryFn: () => api.listCustomers(tenant, undefined, undefined, 100, 0) });
  const customers = q.data?.items || [];
  // Fetch addresses per customer (limited to first 50 to avoid too many requests)
  const addressQs = useQueries({
    queries: customers.slice(0, 50).map((c) => ({
      queryKey: ["r-addr-cust", tenant, c.id],
      queryFn: () => api.getCustomer(tenant, c.id),
      enabled: customers.length > 0,
    })),
  });
  const allLoaded = addressQs.every((aq) => !aq.isLoading);
  if (q.isLoading || !allLoaded) return <Loading />;
  if (q.error) return <ErrorBox message="Failed to load addresses report." />;

  const rows: React.ReactNode[][] = [];
  customers.slice(0, 50).forEach((c, i) => {
    const detail = addressQs[i]?.data;
    (detail?.addresses || []).forEach((a) => {
      rows.push([
        c.full_name || "—",
        c.email,
        a.label,
        <span>{[a.line1, a.city, a.country].filter(Boolean).join(", ")}</span>,
        a.is_default ? <span className="text-emerald-600">Default</span> : <span className="text-neutral-400">—</span>,
      ]);
    });
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Customers" value={customers.length} icon={<Users className="w-6 h-6" />} color="bg-green-50 text-green-600" />
        <StatCard label="Total Addresses" value={rows.length} icon={<MapPin className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="Default Addresses" value={rows.filter((_, idx) => addressQs[idx]?.data?.addresses?.some((a) => a.is_default)).length} icon={<MapPin className="w-6 h-6" />} color="bg-emerald-50 text-emerald-600" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Customer Addresses</h3>
        <Table
          headers={["Customer", "Email", "Label", "Address", "Default"]}
          rows={rows}
        />
        {customers.length > 50 && <p className="text-xs text-neutral-400 mt-2">Showing addresses for first 50 of {customers.length} customers.</p>}
      </div>
    </div>
  );
}
