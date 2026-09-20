# TruCommerce

Multitenant ecommerce platform: Go + gin backend, Next.js frontstore, Vite backoffice, PostgreSQL, Redis, Docker.

## Quick start

```bash
docker compose up -d --build
```

Wait ~30s for migrations + seed, then:

| Service      | URL                          |
|--------------|------------------------------|
| Frontstore   | http://localhost:13000       |
| Backoffice   | http://localhost:13000/backoffice |
| Backend API  | http://localhost:18080       |
| MCP Server   | http://localhost:9100        |
| Postgres     | localhost:15432              |
| Redis        | localhost:16379              |

> Host ports are non-standard (13000/18080/15432/16379) to avoid conflicts with pre-existing services. Internal container ports are standard (3000/5173/8080/5432/6379). The backoffice is served via the frontstore at `/backoffice` — no separate port.

## Credentials

- **Superadmin**: `admin@trucommerce.app` / `admin12345` (platform-wide, login via Backoffice → Superadmin tab)
- **Demo tenant admin**: `demo@trucommerce.app` / `admin123` (business_admin for the `demo` tenant)
- **Demo tenant slug**: `demo`
- Frontstore: http://localhost:13000/t/demo

> **Note**: These credentials are auto-created on first startup via `SEED_SUPERADMIN_EMAIL`/`SEED_SUPERADMIN_PASSWORD` in `.env`. For a fresh production install, leave these unset and use the interactive setup wizard at `/setup` (Backoffice) to create the first superadmin and store.

## Initial Setup / Installation Flow

For a fresh database with no superadmin and no tenants, the Backoffice provides an interactive setup wizard:

1. Navigate to the Backoffice (`http://localhost:13000/backoffice`). The login page checks `/api/setup/status` and redirects to `/setup` if setup is needed.
2. The wizard guides through:
   - **Step 1**: Create the platform superadmin (email, name, password)
   - **Step 2**: Create the first store/tenant + business admin (slug, name, brand color, admin credentials)
3. On completion, the wizard creates: superadmin, tenant, business admin, tenant settings, and default permissions.

### Setup API endpoints (public, no auth)

- `GET /api/setup/status` — returns `{ needs_setup, needs_tenant, has_superadmin, has_tenants, setup_complete, ... }`
- `POST /api/setup/complete` — full setup (superadmin + tenant + admin). Only works when setup is needed. Rejected with 409 after setup is complete.
- `POST /api/platform/setup/create-tenant` — create first tenant only (requires superadmin auth, used when superadmin exists but no tenants).

### Auto-bootstrap vs setup wizard

- When `SEED_SUPERADMIN_EMAIL` is set in `.env`, the backend auto-creates a superadmin on first startup. The setup wizard then only needs to create the first tenant.
- When `SEED_SUPERADMIN_EMAIL` is empty (default), no auto-bootstrap occurs. The setup wizard handles the full installation.

## Architecture

- **Multitenancy**: path-based — `/api/t/:tenant/...`. Tenant resolved by middleware; JWT carries tenant_id; RBAC enforces tenant match.
- **Roles**: `superadmin` (platform), `business_admin` (tenant), `staff` (tenant), `customer` (tenant).
- **Auth**: JWT access tokens (15m) + refresh tokens stored in Redis (30d).
- **Multi-currency**: exchange rates in `exchange_rates` table, cached in-memory (5m TTL), conversion applied to storefront prices.
- **Multi-lingual**: `Accept-Language` header resolved against tenant supported languages; product/category translations in DB.
- **Catalog**: categories (hierarchical), attributes (filterable + variant-defining), attribute options, products, variants (with variant attribute values), product attribute values.
- **Offers**: percentage/fixed, targeted to all/category/product; applied automatically to storefront prices.
- **Discount codes**: percentage/fixed, min subtotal, max uses, validity window; validated via `/discount/validate`.

## Backend (Go + gin)

```
backend/
  cmd/api/main.go          # entrypoint, router wiring, superadmin bootstrap
  internal/
    config/                # env config
    db/                    # pgx pool + embedded SQL migrations
      migrations/          # 0001_init.sql, 0002_seed.sql
    models/                # domain structs
    auth/                  # JWT + bcrypt + Redis refresh tokens
    middleware/            # tenant resolution, JWT auth, RBAC, tenant match
    services/              # store (all DB queries)
    handlers/              # HTTP handlers (auth, tenant, catalog, storefront, dashboard)
    currency/              # exchange rate conversion service
    i18n/                  # language resolution
    redis/                 # redis client
```

Build: `cd backend && go build ./...`
Vet: `cd backend && go vet ./...`

## Frontstore (Next.js 14 App Router)

- TailwindCSS, TanStack Query
- Server-side fetch uses `INTERNAL_API_BASE_URL` (docker service name); client-side uses `NEXT_PUBLIC_API_BASE_URL` (host port).
- Routes: `/` (landing), `/t/:tenant` (storefront listing + filters), `/t/:tenant/products/:slug` (detail with variants)

Typecheck: `cd frontstore && npx tsc --noEmit`

## Backoffice (Vite + React + TS)

- React Router, TanStack Query, TailwindCSS
- Pages: Dashboard, Products (CRUD + variants + variant attributes + product attributes + multi-image gallery), Categories (hierarchical with parent selection), Attributes (CRUD with options + edit support), Offers, Discounts, Orders, Order Detail (workflow + payment transactions), Tax (classes/zones/rates), Shipping (methods/zones/rates), Payments (transactions/refunds/gateways), Customers (list/search/filter/detail/edit/disable/delete + stats), Users & Staff, Tenants (superadmin), Settings.
- Login supports both superadmin (platform) and tenant admin modes.

Typecheck: `cd backoffice && npx tsc --noEmit`

## Key API endpoints

### Platform (superadmin)
- `POST /api/platform/auth/login`
- `GET /api/platform/me`
- `GET /api/platform/tenants`
- `POST /api/platform/tenants` (create tenant + business admin)

### Tenant-scoped public
- `GET /api/t/:tenant/bootstrap` — settings, currencies, languages, categories, attributes
- `GET /api/t/:tenant/products` — listing with filters (`?category=&search=&min_price=&max_price=&currency=&attr=size:s&attr=color:red`)
- `GET /api/t/:tenant/products/:slug` — detail with variants + attributes
- `GET /api/t/:tenant/discount/validate?code=&subtotal=`
- `POST /api/t/:tenant/auth/register` — customer signup
- `POST /api/t/:tenant/auth/login` — tenant user login

### Tenant-scoped admin (auth + role required)
- `GET /api/t/:tenant/dashboard/stats`
- `GET /api/t/:tenant/products/admin` — admin product list (all statuses)
- `GET /api/t/:tenant/products/admin/:id` — get product by ID with full details (variants, attributes, images)
- `POST/PUT/DELETE /api/t/:tenant/products[/:id]` — create/update/delete with full sync of variants, attributes, and images
- `POST /api/t/:tenant/upload/image` — upload a single image (multipart/form-data, field "file"); returns `{url, filename, size, type}`
- `POST /api/t/:tenant/upload/images` — upload multiple images (multipart/form-data, field "files"); returns `{uploaded: [...], errors: [...], total}`
- `POST/PUT/DELETE /api/t/:tenant/categories[/:id]` — hierarchical categories with parent_id
- `POST/PUT/DELETE /api/t/:tenant/attributes[/:id]` — attribute CRUD with options sync
- `GET/POST/PUT/DELETE /api/t/:tenant/offers[/:id]` — offer CRUD with target sync (all/product/category) + date windows
- `GET /api/t/:tenant/discounts/stats` — discount summary statistics
- `GET/POST/PUT/DELETE /api/t/:tenant/discounts[/:id]` — discount code CRUD with max_uses, date windows, min_subtotal
- `GET /api/t/:tenant/users`
- `POST /api/t/:tenant/users/staff`
- `GET /api/t/:tenant/customers` — list customers (search, status filter, pagination)
- `GET /api/t/:tenant/customers/stats` — customer summary statistics
- `GET /api/t/:tenant/customers/:id` — customer detail with order stats + addresses
- `PUT /api/t/:tenant/customers/:id` — update customer (name, phone, active, marketing consent, admin notes)
- `DELETE /api/t/:tenant/customers/:id` — hard-delete a customer
- `GET/PUT /api/t/:tenant/settings`
- `GET/POST/PUT/DELETE /api/t/:tenant/tax/classes[/:classId]` — tax class CRUD
- `GET/POST/PUT/DELETE /api/t/:tenant/tax/zones[/:zoneId]` — tax zone CRUD
- `GET/POST/PUT/DELETE /api/t/:tenant/tax/rates[/:rateId]` — tax rate CRUD
- `GET/POST/PUT/DELETE /api/t/:tenant/shipping/methods[/:methodId]` — shipping method CRUD
- `GET/POST/PUT/DELETE /api/t/:tenant/shipping/zones[/:zoneId]` — shipping zone CRUD
- `GET/POST/PUT/DELETE /api/t/:tenant/shipping/rates[/:rateId]` — shipping rate CRUD
- `GET /api/t/:tenant/payments/transactions` — list payment transactions (filter by status, gateway)
- `GET /api/t/:tenant/payments/transactions/:txnId` — get single payment transaction
- `GET /api/t/:tenant/payments/orders/:orderId/transactions` — list transactions for an order
- `POST /api/t/:tenant/payments/transactions/:txnId/refund` — refund a transaction (full or partial)
- `GET /api/t/:tenant/payments/gateways` — list gateway configurations
- `PUT /api/t/:tenant/payments/gateways/:configId` — update gateway config (enabled, test mode, display name)
- `GET /api/t/:tenant/payments/stats` — payment statistics (collected, refunded, net revenue, by gateway)

### Tenant-scoped returns (admin, auth + role required)
- `GET /api/t/:tenant/returns` — list returns with filters (status, type, search)
- `GET /api/t/:tenant/returns/counts` — returns counts grouped by status
- `GET /api/t/:tenant/returns/:id` — get a single return with items
- `GET /api/t/:tenant/orders/admin/:orderId/returns` — list returns for an order
- `POST /api/t/:tenant/orders/admin/:orderId/returns` — create a return/replacement/exchange request
- `PUT /api/t/:tenant/returns/:id/status` — transition return status (approve, reject, complete, cancel)

### Tenant-scoped returns (customer, auth required)
- `GET /api/t/:tenant/my-returns` — list the logged-in customer's returns (paginated)
- `GET /api/t/:tenant/orders/:orderId/returns` — list returns for the customer's own order
- `POST /api/t/:tenant/orders/:orderId/returns` — create a return request for the customer's own order

### Tenant-scoped store pages (public)
- `GET /api/t/:tenant/page/:slug` — fetch a published page by slug (for storefront rendering)

### Tenant-scoped store pages (admin, auth + role required)
- `GET /api/t/:tenant/pages` — list all store pages
- `GET /api/t/:tenant/pages/:id` — get a single store page by ID
- `POST /api/t/:tenant/pages` — create a new store page
- `PUT /api/t/:tenant/pages/:id` — update a store page (blocks, slug, title, status, SEO)
- `DELETE /api/t/:tenant/pages/:id` — delete a store page (system pages are protected)

### Tenant-scoped wallet (customer, auth required)
- `GET /api/t/:tenant/wallet` — get customer wallet balance (auto-creates on first access)
- `POST /api/t/:tenant/wallet/topup` — top up wallet via any payment gateway (amount, payment_method, payment_details)
- `GET /api/t/:tenant/wallet/transactions` — list customer's wallet transactions (paginated)

### Tenant-scoped wallet (admin, auth + role required)
- `GET /api/t/:tenant/wallet/stats` — aggregate wallet stats (wallet count, total balance, topups, purchases)
- `GET /api/t/:tenant/wallet/all` — list all wallet transactions in tenant (paginated)
- `GET /api/t/:tenant/wallet/:userId` — get a customer's wallet
- `GET /api/t/:tenant/wallet/:userId/transactions` — list a customer's wallet transactions (paginated)
- `POST /api/t/:tenant/wallet/:userId/adjust` — admin credit/debit a customer's wallet (amount, description)

### Tenant-scoped public (tax + shipping)
- `POST /api/t/:tenant/tax/calculate` — calculate tax for cart items + shipping address (returns breakdown)
- `POST /api/t/:tenant/shipping/calculate` — get available shipping options for subtotal + shipping address

## Notes

- Next.js 14.2.x has open DoS/cache-poisoning advisories (see `npm audit`); upgrade to Next 16 for production (breaking change).
- The backend dev container runs `go run ./cmd/api` (air not available for Go 1.23); restart with `docker compose restart backend` after code changes.
- Frontend dev servers have hot reload via volume mounts.

## MCP Server (AI Integration)

The platform exposes a complete [Model Context Protocol](https://modelcontextprotocol.io) server (`backend/cmd/mcp-server`) that wraps all backend API functionalities for AI client integration (Claude Desktop, Cursor, custom agents, etc.). It uses [`mark3labs/mcp-go`](https://github.com/mark3labs/mcp-go).

### Transports

- **stdio** (default): for local AI clients that spawn the server as a subprocess.
- **sse**: HTTP+SSE for remote/networked clients. Runs on port `9100` in Docker.

### Running

The `mcp-server` service is included in `docker-compose.yml` and starts automatically with `docker compose up`. It serves SSE on `http://localhost:9100`.

To run locally (stdio):

```bash
cd backend
MCP_API_BASE_URL=http://localhost:18080 MCP_DEFAULT_TENANT=demo go run ./cmd/mcp-server
```

To run locally (SSE):

```bash
cd backend
go run ./cmd/mcp-server --transport sse --addr :9100
```

### Authentication

The MCP server authenticates against the backend API. Two options:

1. **Per-session login** (recommended): call the `platform_login` (superadmin) or `tenant_login` (tenant user) tool at the start of a session. The token is cached for subsequent calls.
2. **Auto-login at startup**: set `MCP_AUTH_EMAIL`, `MCP_AUTH_PASSWORD`, and optionally `MCP_AUTH_TENANT` env vars. If `MCP_AUTH_TENANT` is set, tenant login is used; otherwise superadmin login.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_API_BASE_URL` | `http://localhost:18080` | Backend API URL |
| `MCP_DEFAULT_TENANT` | `demo` | Default tenant slug for tenant-scoped tools |
| `MCP_TRANSPORT` | `stdio` | Transport: `stdio` or `sse` |
| `MCP_ADDR` | `:9100` | Listen address for SSE transport |
| `MCP_HOST_PORT` | `9100` | Host port mapping for SSE in Docker |
| `MCP_AUTH_EMAIL` | (empty) | Optional auto-login email |
| `MCP_AUTH_PASSWORD` | (empty) | Optional auto-login password |
| `MCP_AUTH_TENANT` | (empty) | Optional tenant slug for auto-login (empty = superadmin) |

### Tool categories

The server registers 200+ tools covering every backend endpoint:

- **Auth**: `platform_login`, `tenant_login`, `register_customer`, `get_me`, `get_my_permissions`, `refresh_token`, `export_my_data`, `delete_my_account`
- **Platform (superadmin)**: `list_tenants`, `get_tenant`, `create_tenant`, `update_tenant`, `set_tenant_active`, `get_tenant_store_stats`, `list_all_users`, `get_platform_stats`, `get_developer_settings`, `get_platform_health`, `get_setup_status`, `complete_setup`
- **Catalog**: products, categories, attributes, offers, discounts (CRUD + list + validate)
- **Orders**: `list_orders`, `get_order`, `get_order_counts`, `update_order_status`, `update_order_notes`
- **Returns**: `list_returns`, `get_return`, `get_return_counts`, `list_order_returns`, `create_return`, `update_return_status`
- **Customers**: `list_customers`, `get_customer`, `get_customer_stats`, `update_customer`, `delete_customer`
- **Users/Staff**: `list_users`, `get_user`, `get_user_stats`, `create_staff`, `update_user`, `set_user_active`, `reset_user_password`, `delete_user`
- **Inventory**: `list_inventory`, `get_inventory_stats`, `adjust_stock`, `list_stock_movements`
- **Payments**: transactions, refunds, gateways, stats
- **Wallet**: customer wallet (get, topup, transactions) + admin wallet (stats, all transactions, customer wallet, adjust)
- **Shipping**: methods, zones, rates, providers, shipments, calculate
- **Tax**: classes, zones, rates, calculate
- **Dashboard**: `get_dashboard_stats`
- **Exports**: `list_export_types`, `estimate_export_size`, `create_export`, `list_exports`, `get_export`
- **Pages**: store page builder CRUD + public page fetch
- **Notifications**: events, templates, preview, send, logs
- **Vendors**: CRUD
- **Storefront (public)**: bootstrap, products, product detail, public info, currencies, languages, payment methods
- **Reviews**: list, summary, create, my review, my reviews, purchased products
- **Cart**: get, add, update, remove, clear, count
- **Wishlist**: get, add, remove, clear, check
- **Checkout**: `place_order`, my orders, my order detail, my shipments, track shipment, my returns, create my return, create payment order
- **Addresses**: list, save, delete
- **Contact**: submit, list submissions, mark read, delete
- **Settings**: tenant settings, SMTP settings (get, update, test)
- **Permissions**: list, list by role, get role, set role, toggle, seed defaults

### Claude Desktop configuration example

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trucommerce": {
      "command": "go",
      "args": ["run", "./cmd/mcp-server"],
      "cwd": "/path/to/trucommerce/backend",
      "env": {
        "MCP_API_BASE_URL": "http://localhost:18080",
        "MCP_DEFAULT_TENANT": "demo"
      }
    }
  }
}
```

### Implementation

- `backend/internal/mcp/client.go` — HTTP client wrapping the backend API with JWT auth and tenant scoping.
- `backend/internal/mcp/server.go` — MCP server creation and tool registration orchestration.
- `backend/internal/mcp/helpers.go` — Argument extraction, query/body building, and result helpers.
- `backend/internal/mcp/tools_*.go` — Tool registration by domain (auth, catalog, orders, customers, payments, shipping, tax, etc.).
- `backend/cmd/mcp-server/main.go` — Entry point with stdio/SSE transport selection.

Build: `cd backend && go build ./cmd/mcp-server`
Test: `cd backend && go test ./internal/mcp/`

## Configuration

All configuration is driven by environment variables. See `.env.example` for the complete reference with documentation for every variable.

### Quick reference

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` / `staging` / `production` |
| `PORT` | `8080` | Backend HTTP port |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `LOG_FORMAT` | `text` | `text` / `json` (json for production) |
| `POSTGRES_DSN` | (from PG user/pass/db) | Full PostgreSQL connection string |
| `DB_MAX_CONNS` | `20` | Max DB pool connections |
| `DB_MIN_CONNS` | `2` | Min DB pool connections |
| `REDIS_ADDR` | `redis:6379` | Redis address |
| `REDIS_PASSWORD` | (empty) | Redis password |
| `JWT_SECRET` | `dev-secret-change-me` | **Must be >=32 chars in production** |
| `JWT_ACCESS_TTL` | `15m` | Access token TTL |
| `JWT_REFRESH_TTL` | `720h` | Refresh token TTL (30 days) |
| `CORS_ALLOWED_ORIGINS` | localhost origins | Comma-separated allowed origins |
| `HTTP_READ_TIMEOUT` | `30s` | HTTP server read timeout |
| `HTTP_WRITE_TIMEOUT` | `30s` | HTTP server write timeout |
| `HTTP_IDLE_TIMEOUT` | `120s` | HTTP server idle timeout |
| `SHUTDOWN_TIMEOUT` | `15s` | Graceful shutdown wait |
| `RATE_LIMIT_ENABLED` | `false` | Enable per-IP rate limiting |
| `COOKIE_SECURE` | `false` | **Must be `true` in production** |
| `ENABLE_TEST_PAYMENTS` | `true` | **Must be `false` in production** |
| `RAZORPAY_KEY_ID` | (empty) | Razorpay gateway key (empty = mock mode) |
| `SMTP_HOST` | (empty) | SMTP server for email (empty = disabled) |

### Production deployment

```bash
# 1. Copy and edit .env for production
cp .env.example .env
# Edit .env: set APP_ENV=production, strong JWT_SECRET, COOKIE_SECURE=true,
#   ENABLE_TEST_PAYMENTS=false, SMTP credentials, payment keys, etc.

# 2. Build and start with the production override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The production override (`docker-compose.prod.yml`):
- Builds production Docker targets (no dev servers, no source mounts)
- Removes PostgreSQL and Redis port exposure to the host
- Enables Redis password requirement
- Sets `restart: always` on all services
- Enforces `COOKIE_SECURE=true`, `ENABLE_TEST_PAYMENTS=false`, `RATE_LIMIT_ENABLED=true`

### Config validation

The backend validates configuration on startup and will refuse to start in production mode if:
- `JWT_SECRET` is the default value or less than 32 characters
- `COOKIE_SECURE` is false
- `ENABLE_TEST_PAYMENTS` is true

### Host port overrides

All host-side ports can be overridden via env vars without editing docker-compose.yml:

| Variable | Default |
|----------|---------|
| `POSTGRES_HOST_PORT` | `15432` |
| `REDIS_HOST_PORT` | `16379` |
| `BACKEND_HOST_PORT` | `18080` |
| `FRONTSTORE_HOST_PORT` | `13000` |
