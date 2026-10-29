# TruCommerce

Single-store ecommerce platform: Go + gin backend, Next.js frontstore, Vite backoffice, PostgreSQL, Redis, Docker.

## Quick start

```bash
docker compose up -d --build
```

Wait ~30s for migrations + seed, then:

| Service      | URL                          |
|--------------|------------------------------|
| Frontstore   | http://localhost:13000       |
| Shop         | http://localhost:13000/shop  |
| Backoffice   | http://localhost:13000/backoffice |
| Backend API  | http://localhost:18080       |
| MCP Server   | http://localhost:9100        |
| Postgres     | localhost:15432              |
| Redis        | localhost:16379              |

> Host ports are non-standard (13000/18080/15432/16379) to avoid conflicts with pre-existing services. Internal container ports are standard (3000/5173/8080/5432/6379). The backoffice is served via the frontstore at `/backoffice` — no separate port.

## Credentials

- **Superadmin**: `admin@trucommerce.app` / `admin12345` (internal platform role, seeded via `SEED_SUPERADMIN_EMAIL`/`SEED_SUPERADMIN_PASSWORD` in `.env`; login via `POST /api/platform/auth/login` or the hidden backoffice UI at `/backoffice/root-access` — intentionally unlinked)
- **Store admin**: created via the setup wizard at `/setup` on first run

## Initial Setup / Installation Flow

For a fresh database with no store, the Backoffice provides a single-step setup wizard:

1. Navigate to the Backoffice (`http://localhost:13000/backoffice`). The login page checks `/api/setup/status` and redirects to `/setup` if setup is needed.
2. The wizard collects: store name, description, brand color, and the store admin's name/email/password.
3. On completion it creates: the store (tenant row), business admin, store settings, and default permissions.

### Setup API endpoints (public, no auth)

- `GET /api/setup/status` — returns `{ needs_setup, has_store, setup_complete, has_superadmin, superadmin_count, tenant_count }`
- `POST /api/setup/complete` — creates the store + its admin. Payload: `{ store_name, store_slug?, store_description?, admin_email, admin_password, admin_name, default_language?, supported_languages?, brand_color? }`. Rejected with 409 once a store exists.

## Architecture

- **Single store**: the platform is single-store focused. The `tenants` table still exists internally (every domain row keeps `tenant_id`), but exactly one store is used. `middleware.ResolveStore` loads it on every `/api` request — pinned by `STORE_SLUG` if set, otherwise the first tenant by `created_at`.
- **URL scheme**: there is no tenant segment. API is `/api/...`, storefront is `/` (branded landing), `/shop` (catalog browsing), `/products/:slug`, `/cart`, `/checkout`, `/orders`, `/account`, `/wishlist`, `/p/:slug` (builder pages).
- **Roles**: `superadmin` (internal platform role — bypasses tenant match/permissions, used for API/MCP access), `business_admin`, `branch_manager`, `staff`, `customer`, `delivery_partner`.
- **Auth**: JWT access tokens (15m) + refresh tokens stored in Redis (30d). `POST /api/auth/login` for store users; `POST /api/platform/auth/login` for superadmin.
- **Multi-currency**: exchange rates in `exchange_rates` table, cached in-memory (5m TTL), conversion applied to storefront prices.
- **Multi-lingual**: `Accept-Language` header resolved against store supported languages; product/category translations in DB.
- **Catalog**: categories (hierarchical), attributes (filterable + variant-defining + batch + internal — internal attribute defs/values are stripped from public bootstrap and product endpoints), attribute options, products, variants (with variant attribute values), product attribute values.
- **Offers**: percentage/fixed, targeted to all/category/product; applied automatically to storefront prices.
- **Discount codes**: percentage/fixed, min subtotal, max uses, validity window; validated via `/discount/validate`.

## Backend (Go + gin)

```
backend/
  cmd/api/main.go          # entrypoint, router wiring, superadmin bootstrap
  internal/
    config/                # env config (incl. STORE_SLUG)
    db/                    # pgx pool + embedded SQL migrations
      migrations/          # 0001_init.sql, 0002_seed.sql
    models/                # domain structs
    auth/                  # JWT + bcrypt + Redis refresh tokens
    middleware/            # single-store resolution, JWT auth, RBAC, tenant match
    services/              # store (all DB queries)
    handlers/              # HTTP handlers (auth, catalog, storefront, dashboard, ...)
    currency/              # exchange rate conversion service
    i18n/                  # language resolution
    redis/                 # redis client
```

Build: `cd backend && go build ./...`
Vet: `cd backend && go vet ./...`
Test: `cd backend && go test ./...`

## Frontstore (Next.js 14 App Router)

- TailwindCSS, TanStack Query
- Server-side fetch uses `INTERNAL_API_BASE_URL` (docker service name); client-side uses the `/api` rewrite proxy.
- Routes: `/` (VT Fresh Chicken branded landing), `/shop` (catalog + filters), `/products/:slug` (detail with variants), `/cart`, `/checkout`, `/orders`, `/account/*`, `/wishlist`, `/p/:slug` (builder pages), `/about`, `/contact`, `/privacy-policy`, `/terms`, `/cookie-policy`
- Root layout fetches `/api/bootstrap` server-side, sets brand CSS vars, wraps everything in `StorefrontShell` (auth/cart/wishlist/currency providers + drawers + cookie banner).

Typecheck: `cd frontstore && npx tsc --noEmit`
Tests: `cd frontstore && npm test`

## Backoffice (Vite + React + TS)

- React Router, TanStack Query, TailwindCSS
- Pages: Dashboard, Products (CRUD + variants + attributes + multi-image gallery), Categories, Attributes, Offers, Discounts, Orders, Order Detail, Returns, Tax, Shipping, Payments, Customers, Users & Staff, Permissions, Notifications, Pages (builder), Reports, Exports, Settings, Developer (`/developer` — superadmin only; payment-method enable/disable + per-gateway credentials in `payment_gateway_configs.config`, which drive `GET /api/payment/methods` and are passed to gateways at payment time, taking precedence over env vars like `RAZORPAY_KEY_ID`); also hosts **Modules & Features** — per-store feature flags in `store_modules` (`returns`, `tax`, `shipping`, `promotions`, `discounts`, `page_builder`). Disabled modules hide related menus/pages/widgets in both backoffice and frontstore (frontstore reads `modules` map from `/api/bootstrap`; backoffice via `useModules()` in `src/lib/modules.ts`).
- Single store login form (`/login`) — email + password, no tenant/superadmin tabs.
- Setup wizard (`/setup`) — single step: store details + admin account.
- API client (`src/lib/api.ts`): all calls hit `/api/...` directly; legacy `tenant` first-args remain in signatures but are ignored.

Typecheck: `cd backoffice && npx tsc -b`
Tests: `cd backoffice && npm test`

## Key API endpoints

> **Pagination**: all list endpoints accept `?limit=&offset=` and return `{items, total, limit, offset}`. Omitting `limit` returns the full list (backward compatible). Backoffice tables are server-side paginated via `api.*(tenant, {limit, offset, ...filters})` (`PageParams` in `src/lib/api.ts`); several lists also take `search`/`status`/`type`/`validity`/`role`/`filter` query params.

### Setup / platform (public or superadmin)
- `GET /api/setup/status`
- `POST /api/setup/complete`
- `POST /api/platform/auth/login` — superadmin login (internal; no platform UI)

### Public (store)
- `GET /api/bootstrap` — settings, currencies, languages, categories, attributes
- `GET /api/products` — listing with filters (`?category=&search=&min_price=&max_price=&currency=&attr=size:s&attr=color:red`)
- `GET /api/products/:slug` — detail with variants + attributes
- `GET /api/discount/validate?code=&subtotal=`
- `GET /api/categories`, `GET /api/attributes`, `GET /api/currencies`, `GET /api/languages`, `GET /api/info`
- `GET /api/modules` — module feature flags (`{items, modules: {code: enabled}}`)
- `GET /api/page/:slug` — published builder page
- `POST /api/contact`, `POST /api/tax/calculate`, `POST /api/shipping/calculate`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/register-from-order`, `POST /api/auth/refresh`
- Cart (`/api/cart*`), wishlist (`/api/wishlist*`), reviews read (`GET /api/reviews/:productId[/summary]`), checkout (`/api/checkout`), payment methods (`/api/payment/methods`)

### Authenticated store users
- `GET /api/me`, `GET /api/me/permissions`, `GET /api/me/export`, `DELETE /api/me/delete`
- `GET/PUT /api/settings`
- `GET/POST/DELETE /api/addresses*`
- `GET /api/wallet`, `POST /api/wallet/topup`, `GET /api/wallet/transactions`
- `GET /api/my-returns`, `GET /api/me/reviews`, `GET /api/me/purchased-products`
- `POST /api/reviews/:productId` — submit a review (customer role only; must have a delivered/fulfilled order containing the product → 403 otherwise, 409 on duplicate)

### Admin (business_admin + staff; permission-gated)
- `GET /api/dashboard/stats`
- Products: `GET /api/products/admin`, `GET /api/products/admin/:id`, `POST/PUT/DELETE /api/products[/:id]`
- Categories: `POST/PUT/DELETE /api/categories[/:id]` · Attributes: `POST/PUT/DELETE /api/attributes[/:id]`
- Offers: `GET/POST/PUT/DELETE /api/offers[/:id]` · Discounts: `GET/POST/PUT/DELETE /api/discounts[/:id]` + `GET /api/discounts/stats`
- Orders: `GET /api/orders/admin`, `GET /api/orders/counts`, `GET/PUT /api/orders/admin/:orderId[/status|/notes]`
- Returns: `GET /api/returns`, `GET /api/returns/counts`, `GET /api/returns/:id`, `PUT /api/returns/:id/status`
- Reviews: `GET /api/reviews` (filters: `product_id`, `rating`, `status=approved|pending`, `search`), `PUT /api/reviews/:id` (`{is_approved}`), `DELETE /api/reviews/:id` (superadmin only)
- Inventory: `GET /api/inventory`, `GET /api/inventory/stats`, `POST /api/inventory/adjust`, `GET /api/inventory/movements`
- Vendors: `GET/POST/PUT/DELETE /api/vendors[/:id]`
- Customers: `GET /api/customers`, `GET /api/customers/stats`, `GET/PUT/DELETE /api/customers/:id`
- Users/staff: `GET /api/users`, `GET /api/users/stats`, `POST /api/users/staff`, `GET/PUT/DELETE /api/users/:id`, `PUT /api/users/:id/active`, `PUT /api/users/:id/password`
- Permissions: `GET /api/permissions`, `GET /api/permissions/roles`, `GET/PUT /api/permissions/roles/:role`, `PUT /api/permissions/roles/:role/toggle`, `POST /api/permissions/seed`
- Tax: `GET/POST/PUT/DELETE /api/tax/(classes|zones|rates)/[:id]`
- Shipping: `GET/POST/PUT/DELETE /api/shipping/(methods|zones|rates|providers)/[:id]`, shipments under `/api/shipping/orders/:orderId/shipments`
- Payments: `GET /api/payments/transactions`, `GET /api/payments/transactions/:txnId`, `POST /api/payments/transactions/:txnId/refund`, `GET/PUT /api/payments/gateways[/:configId]`, `GET /api/payments/stats`
- Developer (superadmin only): `PUT /api/developer/modules/:code` — toggle a store module (`{is_enabled}`)
- Wallet admin: `GET /api/wallet/stats`, `GET /api/wallet/all`, `GET /api/wallet/:userId[/transactions]`, `POST /api/wallet/:userId/adjust`
- Pages: `GET/POST/PUT/DELETE /api/pages[/:id]` · Contact: `GET/PUT/DELETE /api/contact/submissions[/:id]`
- Notifications: events, templates, preview, send, logs under `/api/notifications/*`
- Exports: `GET/POST /api/exports`, `GET /api/exports/types`, `GET /api/exports/estimate`, `GET /api/exports/:id`, `GET /api/exports/download/:id`
- Uploads: `POST /api/upload/image`, `POST /api/upload/images`
- SMTP: `GET/PUT /api/settings/smtp`, `POST /api/settings/smtp/test`

## Notes

- Next.js 14.2.x has open DoS/cache-poisoning advisories (see `npm audit`); upgrade to Next 16 for production (breaking change).
- The backend dev container runs `go run ./cmd/api` (air not available for Go 1.23); restart with `docker compose restart backend` after code changes.
- Frontend dev servers have hot reload via volume mounts.
- Old multitenant URLs (`/api/t/:slug/...`, frontstore `/:slug/...`) are gone — update any external integrations.
- `STORE_SLUG` env var optionally pins which tenant row the store resolves to; default = first tenant by `created_at`.

## MCP Server (AI Integration)

The platform exposes a [Model Context Protocol](https://modelcontextprotocol.io) server (`backend/cmd/mcp-server`) that wraps the store API for AI clients (Claude Desktop, Cursor, custom agents). It uses [`mark3labs/mcp-go`](https://github.com/mark3labs/mcp-go).

### Transports

- **stdio** (default): local AI clients that spawn the server as a subprocess.
- **sse**: HTTP+SSE for remote/networked clients. Runs on port `9100` in Docker.

### Running

The `mcp-server` service is included in `docker-compose.yml` and starts automatically with `docker compose up`. It serves SSE on `http://localhost:9100`.

```bash
cd backend
MCP_API_BASE_URL=http://localhost:18080 go run ./cmd/mcp-server            # stdio
go run ./cmd/mcp-server --transport sse --addr :9100                       # SSE
```

### Authentication

1. **Per-session login** (recommended): call `store_login` (store user) or `platform_login` (superadmin) at the start of a session. The token is cached for subsequent calls.
2. **Auto-login at startup**: set `MCP_AUTH_EMAIL` + `MCP_AUTH_PASSWORD` (store user login by default). Set `MCP_AUTH_PLATFORM=true` for superadmin login.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_API_BASE_URL` | `http://localhost:18080` | Backend API URL |
| `MCP_TRANSPORT` | `stdio` | Transport: `stdio` or `sse` |
| `MCP_ADDR` | `:9100` | Listen address for SSE transport |
| `MCP_HOST_PORT` | `9100` | Host port mapping for SSE in Docker |
| `MCP_AUTH_EMAIL` | (empty) | Optional auto-login email |
| `MCP_AUTH_PASSWORD` | (empty) | Optional auto-login password |
| `MCP_AUTH_PLATFORM` | (empty) | `true` = superadmin login; default = store user |

### Tool categories

The server registers 200+ tools covering every store endpoint:

- **Auth**: `store_login`, `platform_login`, `register_customer`, `get_me`, `get_my_permissions`, `refresh_token`, `export_my_data`, `delete_my_account`
- **Setup**: `get_setup_status`, `complete_setup`
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
- **Settings**: store settings, SMTP settings (get, update, test)
- **Permissions**: list, list by role, get role, set role, toggle, seed defaults

### Implementation

- `backend/internal/mcp/client.go` — HTTP client wrapping the backend API with JWT auth (`APIPath` builds `/api/...` URLs).
- `backend/internal/mcp/server.go` — MCP server creation and tool registration.
- `backend/internal/mcp/helpers.go` — Argument extraction, query/body building, result helpers.
- `backend/internal/mcp/tools_*.go` — Tool registration by domain.
- `backend/cmd/mcp-server/main.go` — Entry point with stdio/SSE transport selection.

Build: `cd backend && go build ./cmd/mcp-server`
Test: `cd backend && go test ./internal/mcp/`

## Configuration

All configuration is driven by environment variables. See `.env.example` for the complete reference.

### Quick reference

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` / `staging` / `production` |
| `PORT` | `8080` | Backend HTTP port |
| `STORE_SLUG` | (empty) | Pin the store to a specific tenant slug (default: first tenant) |
| `POSTGRES_DSN` | (from PG user/pass/db) | Full PostgreSQL connection string |
| `REDIS_ADDR` | `redis:6379` | Redis address |
| `JWT_SECRET` | `dev-secret-change-me` | **Must be >=32 chars in production** |
| `JWT_ACCESS_TTL` | `15m` | Access token TTL |
| `JWT_REFRESH_TTL` | `720h` | Refresh token TTL (30 days) |
| `SEED_SUPERADMIN_EMAIL` | (empty) | Optional superadmin bootstrap on first startup |
| `SEED_SUPERADMIN_PASSWORD` | (empty) | Superadmin password |
| `CORS_ALLOWED_ORIGINS` | localhost origins | Comma-separated allowed origins |

## Multi-branch (outlets)

The store supports multiple branches, each with its own delivery service area (center lat/lng + radius_km + named areas). Migration `0040_branches.sql` seeds a default branch from the legacy `tenant_settings.service_area`.

- **Roles**: `branch_manager` is bound to a branch via `users.branch_id`; `staff` can also be branch-assigned. Their JWT carries `bid`; the backend scopes orders, customers, inventory and stock movements to it automatically.
- **Checkout**: `POST /api/checkout` accepts `delivery_area`, `delivery_lat`, `delivery_lng`. When active branches exist the order is assigned to the nearest covering branch (else 422). `orders.branch_id` records it.
- **Inventory**: `branch_stock` is a per-branch overlay — when a row exists it is enforced at checkout; otherwise items draw from shared `products.stock`/`variants.stock`.
- **Offers/discounts**: `branch_id NULL` = all branches; branch-bound codes validate only for that branch.
- **API**: admin `GET/POST/PUT/DELETE /api/branches[/:id]` + `PUT /api/branches/:id/default` (perms `branches.view`/`branches.manage`); public `GET /api/delivery/check?lat=&lng=&area=`; `GET /api/bootstrap` includes `branches`.
- **Backoffice**: `/backoffice/branches` manages outlets; `/backoffice/b/:slug/...` is the branch-scoped backoffice (same pages, scoped data). Admin scoping also works via `X-Branch-Id` header or `?branch_id=`.
- Branch-scoped users are redirected to `/b/<slug>` after login.

## Delivery partners

`delivery_partner` users get a dedicated portal at `/backoffice/delivery` (sign-in at `/backoffice/delivery/login`; the main login also redirects them). Each partner is allocated to ≥1 branch via the `delivery_partner_branches` join table (managed in Users & Staff — `branch_ids` on create/update; `users.branch_id` mirrors the first allocation). Delivery partners cannot access the admin backoffice.

Order workflow adds a `ready` status: `processing → ready → shipped → delivered` (`processing → shipped` still allowed for carrier flows). Staff marks an order `ready`; partners see it in their queue for their allocated branches and either **claim** it (assign + out-for-delivery in one step) or staff/managers/admins **assign** it to them (`PUT /api/delivery/orders/:id/assign`, `orders.update` perm — assignment stays `ready` until the partner taps Start). `orders.delivery_partner_id`/`delivery_assigned_at` track assignment.

Endpoints (`/api/delivery`, authed):
- `GET /branches` — partner's allocated branches (admins: scoped/all)
- `GET /orders?view=queue|active|history[&partner_id=&unassigned=]` — queue = `ready` orders in scope; partners auto-scoped to their branches
- `GET /partners?branch_id=` — active partners for the assignment picker (admin roles)
- `PUT /orders/:id/assign {partner_id|""}` — assign/reassign/unassign (admin roles, `orders.update`)
- `POST /orders/:id/claim` · `POST /orders/:id/start` · `POST /orders/:id/deliver` — partner actions

## CI — Docker image publishing

`.github/workflows/docker.yml` builds the `production` target of `backend/`, `frontstore/`, and `backoffice/` on every push to `main` (and via manual dispatch) and pushes to Docker Hub in parallel:

- Images: `ntoric/vtchicken_backend`, `ntoric/vtchicken_frontstore`, `ntoric/vtchicken_backoffice` (namespace overridable via the `DOCKERHUB_NAMESPACE` repo variable)
- Tags per push: `latest`, `production`, `main`, `sha-<short>`
- Required secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (Docker Hub access token)
- Optional vars: `INTERNAL_API_BASE_URL`, `INTERNAL_BACKOFFICE_URL` — baked into the frontstore image at build time (next.config.js rewrites); defaults are the compose service names
- Platform: `linux/amd64` (uncomment QEMU + `platforms` in the workflow for multi-arch)
- Each service dir has a `.dockerignore`; `backend/` intentionally keeps `.git/` in context for version stamping (`git describe` in the Dockerfile)

## Staging deployment & performance

- Staging: `http://222.167.207.53:5000/` (`/opt/vtc` on `ntoric001`, `docker-compose.yml` + `docker-compose.staging.yml`, `FRONTSTORE_HOST_PORT=5000`). Intended domain: `vtchicken.mohammedshahid.in`.
- The origin uplink is bandwidth-constrained — minimizing bytes and enabling edge caching matter more than render optimizations.
- Frontstore: public fetches (`fetchBootstrap`, `fetchProduct`, `fetchStorePage`) use Next data-cache `revalidate` instead of `no-store`, so most routes prerender as static/ISR. Note: `next build` runs without a reachable backend → the first request(s) after deploy may serve the "Store unavailable" fallback until the first revalidation (≤60s). Hit `/` once post-deploy to warm the cache.
- `next.config.js`: image optimizer serves AVIF + WebP with `minimumCacheTTL: 86400`.
- Optional Caddy edge proxy (HTTPS + HTTP/2/3 + brotli/zstd): `docker compose -f docker-compose.yml -f docker-compose.staging.yml --profile edge up -d` — needs DNS for `SITE_DOMAIN` + ports 80/443. A CDN (e.g. Cloudflare) in front is the bigger win since `_next/static` and optimized images are immutable/cacheable.
- `frontstore/src/components/LandingPage.tsx` is currently unused (homepage renders `LandingHome.tsx`); framer-motion ships via `Header.tsx` only, using `LazyMotion` + `m` (domAnimation feature bundle).
