import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, Clock, GitBranch, MemoryStick, Monitor, RefreshCw,
  Settings, Database, Zap, KeyRound, Globe, Server, Gauge,
  Cookie, Paperclip, Mail, CreditCard, Coins, FileText, AlertTriangle, XCircle,
  Plug, BookOpen, Copy,
} from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import type { DeveloperSettings as DevSettings, PlatformHealth } from "@/types";

export function DeveloperSettings() {
  const settingsQ = useQuery({
    queryKey: ["platform-dev-settings"],
    queryFn: () => api.platformDevSettings(),
    refetchInterval: 10000,
  });

  const healthQ = useQuery({
    queryKey: ["platform-health"],
    queryFn: () => api.platformHealth(),
    refetchInterval: 5000,
  });

  if (settingsQ.isLoading) {
    return (
      <div>
        <PageHeader title="Developer Settings" subtitle="Platform configuration & system info" />
        <div className="bg-white rounded-2xl border p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-32 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (settingsQ.error) {
    return (
      <div>
        <PageHeader title="Developer Settings" subtitle="Platform configuration & system info" />
        <div className="bg-rose-50 text-rose-600 rounded-xl p-4">
          Failed to load developer settings. {(settingsQ.error as Error).message}
        </div>
      </div>
    );
  }

  const s: DevSettings = settingsQ.data!;
  const h: PlatformHealth | undefined = healthQ.data;

  return (
    <div>
      <PageHeader title="Developer Settings" subtitle="Platform configuration & system info" />

      {/* ===== System Health (live) ===== */}
      {h && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <HealthCard label="Status" value={h.status} icon={<CheckCircle2 className="w-5 h-5" />} color={h.status === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"} />
          <HealthCard label="Uptime" value={h.uptime} icon={<Clock className="w-5 h-5" />} color="bg-blue-50 text-blue-600" />
          <HealthCard label="Goroutines" value={h.goroutines} icon={<GitBranch className="w-5 h-5" />} color="bg-purple-50 text-purple-600" />
          <HealthCard label="Alloc Memory" value={`${h.memory.alloc_mb} MB`} icon={<MemoryStick className="w-5 h-5" />} color="bg-amber-50 text-amber-600" />
          <HealthCard label="Sys Memory" value={`${h.memory.sys_mb} MB`} icon={<Monitor className="w-5 h-5" />} color="bg-pink-50 text-pink-600" />
          <HealthCard label="GC Count" value={h.memory.gc_count} icon={<RefreshCw className="w-5 h-5" />} color="bg-indigo-50 text-indigo-600" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ===== System ===== */}
        <SettingsCard title="System" icon={<Settings className="w-5 h-5" />}>
          <Row label="App Name" value={s.system.app_name} />
          <Row label="Environment" value={<Badge text={s.system.app_env} variant={s.system.app_env === "production" ? "danger" : s.system.app_env === "staging" ? "warning" : "info"} />} />
          <Row label="Version" value={s.system.version} mono />
          {s.system.commit && <Row label="Commit" value={s.system.commit} mono />}
          {s.system.build_date && <Row label="Build Date" value={new Date(s.system.build_date).toLocaleString()} />}
          <Row label="Go Version" value={s.system.go_version} mono />
          <Row label="Port" value={s.system.port} />
          <Row label="Started At" value={new Date(s.system.started_at).toLocaleString()} />
          <Row label="Uptime" value={s.system.uptime} />
          <Row label="CPUs" value={String(s.system.num_cpu)} />
          <Row label="Goroutines" value={String(s.system.goroutines)} />
        </SettingsCard>

        {/* ===== Database ===== */}
        <SettingsCard title="Database (PostgreSQL)" icon={<Database className="w-5 h-5" />}>
          <Row label="Max Connections" value={String(s.database.max_conns)} />
          <Row label="Min Connections" value={String(s.database.min_conns)} />
          <Row label="Max Conn Lifetime" value={s.database.max_conn_lifetime} />
          <Row label="Max Conn Idle Time" value={s.database.max_conn_idle_time} />
        </SettingsCard>

        {/* ===== Redis ===== */}
        <SettingsCard title="Redis" icon={<Zap className="w-5 h-5" />}>
          <Row label="Address" value={s.redis.addr} mono />
          <Row label="Database" value={String(s.redis.db)} />
          <Row label="Password" value={s.redis.has_password ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Set</span> : <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4 text-rose-400" /> Not set</span>} />
        </SettingsCard>

        {/* ===== JWT / Auth ===== */}
        <SettingsCard title="JWT / Authentication" icon={<KeyRound className="w-5 h-5" />}>
          <Row label="Access Token TTL" value={s.jwt.access_ttl} />
          <Row label="Refresh Token TTL" value={s.jwt.refresh_ttl} />
          <Row label="Secret Set" value={s.jwt.secret_set ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Yes</span> : <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4 text-rose-400" /> No</span>} />
          <Row label="Secret Length" value={`${s.jwt.secret_len} chars`} />
          {s.jwt.secret_len < 32 && (
            <div className="mt-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4 inline-block mr-1 -mt-0.5" /> JWT secret is less than 32 characters. Not safe for production.
            </div>
          )}
        </SettingsCard>

        {/* ===== CORS ===== */}
        <SettingsCard title="CORS" icon={<Globe className="w-5 h-5" />}>
          <Row label="Max Age" value={s.cors.max_age} />
          <div className="mt-2">
            <p className="text-xs text-slate-400 mb-1">Allowed Origins</p>
            <div className="space-y-1">
              {s.cors.allowed_origins.map((o) => (
                <div key={o} className="font-mono text-xs bg-slate-50 rounded px-2 py-1 text-slate-600">{o}</div>
              ))}
            </div>
          </div>
        </SettingsCard>

        {/* ===== HTTP Server ===== */}
        <SettingsCard title="HTTP Server" icon={<Server className="w-5 h-5" />}>
          <Row label="Read Timeout" value={s.http.read_timeout} />
          <Row label="Write Timeout" value={s.http.write_timeout} />
          <Row label="Idle Timeout" value={s.http.idle_timeout} />
          <Row label="Shutdown Timeout" value={s.http.shutdown_timeout} />
        </SettingsCard>

        {/* ===== Rate Limiting ===== */}
        <SettingsCard title="Rate Limiting" icon={<Gauge className="w-5 h-5" />}>
          <Row label="Enabled" value={s.rate_limiting.enabled ? <Badge text="On" variant="success" /> : <Badge text="Off" variant="muted" />} />
          <Row label="Requests / Window" value={String(s.rate_limiting.requests)} />
          <Row label="Window" value={s.rate_limiting.window} />
          <Row label="Burst" value={String(s.rate_limiting.burst)} />
          {!s.rate_limiting.enabled && (
            <div className="mt-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Rate limiting is disabled. Enable in production via RATE_LIMIT_ENABLED=true.
            </div>
          )}
        </SettingsCard>

        {/* ===== Cookie / Session ===== */}
        <SettingsCard title="Cookie / Session" icon={<Cookie className="w-5 h-5" />}>
          <Row label="Secure" value={s.cookie.secure ? <Badge text="On" variant="success" /> : <Badge text="Off" variant="danger" />} />
          <Row label="SameSite" value={s.cookie.same_site} />
          <Row label="Domain" value={s.cookie.domain || "—"} mono />
          {!s.cookie.secure && (
            <div className="mt-2 bg-rose-50 text-rose-700 rounded-lg px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4 inline-block mr-1 -mt-0.5" /> COOKIE_SECURE is off. Must be true in production.
            </div>
          )}
        </SettingsCard>

        {/* ===== File Uploads ===== */}
        <SettingsCard title="File Uploads" icon={<Paperclip className="w-5 h-5" />}>
          <Row label="Max Size" value={`${(s.uploads.max_size / 1024 / 1024).toFixed(1)} MB`} />
          <div className="mt-2">
            <p className="text-xs text-slate-400 mb-1">Allowed Types</p>
            <div className="flex flex-wrap gap-1">
              {s.uploads.allowed_types.map((t) => (
                <span key={t} className="font-mono text-xs bg-slate-100 rounded px-2 py-0.5 text-slate-600">{t}</span>
              ))}
            </div>
          </div>
        </SettingsCard>

        {/* ===== SMTP / Email ===== */}
        <SettingsCard title="SMTP / Email" icon={<Mail className="w-5 h-5" />}>
          <Row label="Enabled" value={s.smtp.enabled ? <Badge text="Yes" variant="success" /> : <Badge text="No" variant="muted" />} />
          <Row label="Host" value={s.smtp.host || "—"} mono />
          <Row label="Port" value={String(s.smtp.port)} />
          <Row label="Username" value={s.smtp.user || "—"} mono />
          <Row label="From Email" value={s.smtp.from || "—"} mono />
          <Row label="From Name" value={s.smtp.from_name || "—"} />
          <Row label="Password" value={s.smtp.has_password ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Set</span> : <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4 text-rose-400" /> Not set</span>} />
        </SettingsCard>

        {/* ===== Payments ===== */}
        <SettingsCard title="Payment Gateways" icon={<CreditCard className="w-5 h-5" />}>
          <Row label="Test Payments" value={s.payments.test_payments_enabled ? <Badge text="Enabled" variant="warning" /> : <Badge text="Disabled" variant="muted" />} />
          <Row label="Razorpay Key ID" value={s.payments.razorpay_key_id || "—"} mono />
          <Row label="Razorpay Secret" value={s.payments.has_razorpay_secret ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Set</span> : <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4 text-rose-400" /> Not set</span>} />
          {s.payments.test_payments_enabled && (
            <div className="mt-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs">
              <AlertTriangle className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Test payments are enabled. Disable in production via ENABLE_TEST_PAYMENTS=false.
            </div>
          )}
        </SettingsCard>

        {/* ===== Currency ===== */}
        <SettingsCard title="Currency Cache" icon={<Coins className="w-5 h-5" />}>
          <Row label="Cache TTL" value={s.currency.cache_ttl} />
        </SettingsCard>

        {/* ===== Logging ===== */}
        <SettingsCard title="Logging" icon={<FileText className="w-5 h-5" />}>
          <Row label="Log Level" value={<Badge text={s.logging.log_level} variant="info" />} />
          <Row label="Log Format" value={s.logging.log_format} />
        </SettingsCard>
      </div>

      {/* ===== MCP Server (AI Integration) ===== */}
      <McpSection />
    </div>
  );
}

function SettingsCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-6">
      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-900 font-medium text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function Badge({ text, variant }: { text: string; variant: "success" | "danger" | "warning" | "info" | "muted" }) {
  const colors = {
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-rose-100 text-rose-700",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-blue-100 text-blue-700",
    muted: "bg-slate-100 text-slate-500",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}>{text}</span>;
}

function HealthCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 capitalize">{value}</p>
    </div>
  );
}

// MCP SSE endpoint — derived from current host (same as backend port mapping).
const MCP_SSE_URL = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:9100/sse`
  : "http://localhost:9100/sse";

function McpSection() {
  const [copied, setCopied] = useState<string | null>(null);
  const [docOpen, setDocOpen] = useState(false);

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const CopyBtn = ({ k, text }: { k: string; text: string }) => (
    <button
      onClick={() => copy(k, text)}
      className="text-slate-400 hover:text-slate-600 transition ml-2 flex-shrink-0"
      title="Copy to clipboard"
    >
      {copied === k ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  const claudeConfig = `{
  "mcpServers": {
    "trucommerce": {
      "url": "${MCP_SSE_URL}"
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "trucommerce": {
      "url": "${MCP_SSE_URL}"
    }
  }
}`;

  const stdioCmd = `cd backend
MCP_API_BASE_URL=http://localhost:18080 \\
  MCP_DEFAULT_TENANT=demo \\
  go run ./cmd/mcp-server --transport stdio`;

  return (
    <div className="mt-6 space-y-6">
      {/* Configuration */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Plug className="w-5 h-5 text-indigo-500" />
          MCP Server (AI Integration)
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          The TruCommerce platform exposes a Model Context Protocol server with 200+ tools covering every backend endpoint.
          Connect AI clients (Claude Desktop, Cursor, custom agents) to manage your store via natural language.
        </p>
        <div className="space-y-2.5">
          <Row label="Transport" value={<Badge text="SSE (HTTP+SSE)" variant="info" />} />
          <Row label="SSE Endpoint" value={
            <span className="flex items-center font-mono text-xs">
              {MCP_SSE_URL}
              <CopyBtn k="sse" text={MCP_SSE_URL} />
            </span>
          } />
          <Row label="Default Tenant" value="demo" mono />
          <Row label="API Base URL" value="http://backend:8080 (internal)" mono />
          <Row label="Auth Mode" value="Per-session login (recommended)" />
        </div>

        {/* Connection snippets */}
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700">Claude Desktop / Cursor config</label>
              <CopyBtn k="claude" text={claudeConfig} />
            </div>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto font-mono text-slate-700">{claudeConfig}</pre>
            <p className="text-xs text-slate-400 mt-1">Add to <code className="text-slate-600">claude_desktop_config.json</code> (Claude) or <code className="text-slate-600">.cursor/mcp.json</code> (Cursor).</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-700">Local stdio mode</label>
              <CopyBtn k="stdio" text={stdioCmd} />
            </div>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto font-mono text-slate-700">{stdioCmd}</pre>
            <p className="text-xs text-slate-400 mt-1">For local AI clients that spawn the server as a subprocess.</p>
          </div>
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-white rounded-2xl border p-6">
        <button
          onClick={() => setDocOpen(!docOpen)}
          className="w-full flex items-center justify-between mb-2"
        >
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            MCP Documentation
          </h3>
          <span className="text-slate-400 text-sm">{docOpen ? "Hide" : "Show"}</span>
        </button>

        {docOpen && (
          <div className="text-sm text-slate-600 space-y-5 mt-4">
            {/* Overview */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Overview</h4>
              <p>
                The MCP server (<code className="text-xs bg-slate-100 px-1 rounded">backend/cmd/mcp-server</code>) wraps all backend API functionalities
                for AI client integration using the <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Model Context Protocol</a>.
                It uses <a href="https://github.com/mark3labs/mcp-go" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">mark3labs/mcp-go</a> and registers 200+ tools.
              </p>
            </section>

            {/* Transports */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Transports</h4>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li><strong>SSE</strong> (default in Docker): HTTP+SSE for remote/networked clients. Runs on port <code className="text-xs bg-slate-100 px-1 rounded">9100</code>.</li>
                <li><strong>stdio</strong>: for local AI clients that spawn the server as a subprocess (e.g. Claude Desktop local mode).</li>
              </ul>
            </section>

            {/* Authentication */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Authentication</h4>
              <p className="mb-1.5">The MCP server authenticates against the backend API. Two options:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li><strong>Per-session login</strong> (recommended): call <code className="text-xs bg-slate-100 px-1 rounded">platform_login</code> (superadmin) or <code className="text-xs bg-slate-100 px-1 rounded">tenant_login</code> (tenant user) at the start of a session. The token is cached for subsequent calls.</li>
                <li><strong>Auto-login at startup</strong>: set <code className="text-xs bg-slate-100 px-1 rounded">MCP_AUTH_EMAIL</code>, <code className="text-xs bg-slate-100 px-1 rounded">MCP_AUTH_PASSWORD</code>, and optionally <code className="text-xs bg-slate-100 px-1 rounded">MCP_AUTH_TENANT</code> env vars. If tenant is set, tenant login is used; otherwise superadmin login.</li>
              </ol>
            </section>

            {/* Environment Variables */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Environment Variables</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Variable</th>
                      <th className="px-3 py-2 font-medium">Default</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="px-3 py-2 font-mono">MCP_API_BASE_URL</td><td className="px-3 py-2">http://localhost:18080</td><td className="px-3 py-2">Backend API URL</td></tr>
                    <tr><td className="px-3 py-2 font-mono">MCP_DEFAULT_TENANT</td><td className="px-3 py-2">demo</td><td className="px-3 py-2">Default tenant slug for tenant-scoped tools</td></tr>
                    <tr><td className="px-3 py-2 font-mono">MCP_TRANSPORT</td><td className="px-3 py-2">stdio</td><td className="px-3 py-2">Transport: <code>stdio</code> or <code>sse</code></td></tr>
                    <tr><td className="px-3 py-2 font-mono">MCP_ADDR</td><td className="px-3 py-2">:9100</td><td className="px-3 py-2">Listen address for SSE transport</td></tr>
                    <tr><td className="px-3 py-2 font-mono">MCP_HOST_PORT</td><td className="px-3 py-2">9100</td><td className="px-3 py-2">Host port mapping for SSE in Docker</td></tr>
                    <tr><td className="px-3 py-2 font-mono">MCP_AUTH_EMAIL</td><td className="px-3 py-2">(empty)</td><td className="px-3 py-2">Optional auto-login email</td></tr>
                    <tr><td className="px-3 py-2 font-mono">MCP_AUTH_PASSWORD</td><td className="px-3 py-2">(empty)</td><td className="px-3 py-2">Optional auto-login password</td></tr>
                    <tr><td className="px-3 py-2 font-mono">MCP_AUTH_TENANT</td><td className="px-3 py-2">(empty)</td><td className="px-3 py-2">Optional tenant slug for auto-login (empty = superadmin)</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Tool Categories */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Tool Categories</h4>
              <p className="mb-2">The server registers 200+ tools covering every backend endpoint:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {[
                  ["Auth", "platform_login, tenant_login, register_customer, get_me, refresh_token, export_my_data, delete_my_account"],
                  ["Platform (superadmin)", "list_tenants, get_tenant, create_tenant, update_tenant, set_tenant_active, get_platform_stats, get_developer_settings, get_platform_health, get_setup_status, complete_setup"],
                  ["Catalog", "products, categories, attributes (CRUD + list)"],
                  ["Offers & Discounts", "offers CRUD, discounts CRUD, validate_discount, get_discount_stats"],
                  ["Orders", "list_orders, get_order, get_order_counts, update_order_status, update_order_notes"],
                  ["Returns", "list_returns, get_return, get_return_counts, create_return, update_return_status"],
                  ["Customers", "list_customers, get_customer, get_customer_stats, update_customer, delete_customer"],
                  ["Users / Staff", "list_users, get_user, create_staff, update_user, set_user_active, reset_user_password, delete_user"],
                  ["Inventory", "list_inventory, get_inventory_stats, adjust_stock, list_stock_movements"],
                  ["Payments", "list_payment_transactions, get_payment_transaction, refund_transaction, list_payment_gateways, update_payment_gateway, get_payment_stats"],
                  ["Wallet", "get_my_wallet, topup_wallet, list_my_wallet_transactions, get_wallet_stats, list_all_wallet_transactions, adjust_customer_wallet"],
                  ["Shipping", "methods, zones, rates, providers, shipments, track_shipment, calculate_shipping"],
                  ["Tax", "classes, zones, rates, calculate_tax"],
                  ["Dashboard", "get_dashboard_stats"],
                  ["Exports", "list_export_types, estimate_export_size, create_export, list_exports, get_export"],
                  ["Pages", "list_pages, get_page, create_page, update_page, delete_page, get_public_page"],
                  ["Notifications", "events, templates, preview, send, logs"],
                  ["Vendors", "CRUD"],
                  ["Storefront (public)", "get_storefront_bootstrap, list_storefront_products, get_storefront_product, get_tenant_public_info, list_storefront_currencies, list_storefront_languages, list_payment_methods"],
                  ["Reviews", "list_reviews, get_review_summary, create_review, get_my_review, list_my_reviews, list_purchased_products"],
                  ["Cart", "get_cart, add_cart_item, update_cart_item, remove_cart_item, clear_cart, get_cart_count"],
                  ["Wishlist", "get_wishlist, add_wishlist_item, remove_wishlist_item, clear_wishlist, check_wishlist_product"],
                  ["Checkout", "place_order, list_my_orders, get_my_order, list_my_order_shipments, track_my_shipment, list_my_returns, create_my_return, get_my_return_eligibility, create_payment_order"],
                  ["Addresses", "list_addresses, save_address, delete_address"],
                  ["Contact", "submit_contact, list_contact_submissions, mark_contact_read, delete_contact_submission"],
                  ["Settings", "get_tenant_settings, update_tenant_settings, get_smtp_settings, update_smtp_settings, test_smtp_settings"],
                  ["Permissions", "list_permissions, list_role_permissions, get_role_permissions, set_role_permissions, toggle_permission, seed_default_permissions"],
                ].map(([cat, tools]) => (
                  <div key={cat} className="border border-slate-100 rounded-lg p-2">
                    <div className="font-medium text-slate-700">{cat}</div>
                    <div className="text-slate-500 mt-0.5">{tools}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Usage Flow */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Usage Flow</h4>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Authenticate first: call <code className="text-xs bg-slate-100 px-1 rounded">platform_login</code> (superadmin) or <code className="text-xs bg-slate-100 px-1 rounded">tenant_login</code> (tenant user) with credentials.</li>
                <li>All tenant-scoped tools operate on the tenant set by <code className="text-xs bg-slate-100 px-1 rounded">tenant_login</code>.</li>
                <li>Public storefront tools require an explicit <code className="text-xs bg-slate-100 px-1 rounded">tenant</code> parameter.</li>
                <li>Tool results are JSON text. Errors are returned with <code className="text-xs bg-slate-100 px-1 rounded">isError=true</code>.</li>
              </ol>
            </section>

            {/* Development Credentials */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Development Credentials</h4>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>Superadmin: <code className="text-xs bg-slate-100 px-1 rounded">admin@trucommerce.app</code> / <code className="text-xs bg-slate-100 px-1 rounded">admin12345</code></li>
                <li>Demo tenant admin: <code className="text-xs bg-slate-100 px-1 rounded">demo@trucommerce.app</code> / <code className="text-xs bg-slate-100 px-1 rounded">admin123</code> (tenant slug: <code className="text-xs bg-slate-100 px-1 rounded">demo</code>)</li>
              </ul>
            </section>

            {/* Running Locally */}
            <section>
              <h4 className="font-semibold text-slate-800 mb-1.5">Running Locally (without Docker)</h4>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-slate-400 mb-1">stdio (default):</div>
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto font-mono text-slate-700">cd backend
MCP_API_BASE_URL=http://localhost:18080 MCP_DEFAULT_TENANT=demo go run ./cmd/mcp-server</pre>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">SSE:</div>
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto font-mono text-slate-700">cd backend
go run ./cmd/mcp-server --transport sse --addr :9100</pre>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
