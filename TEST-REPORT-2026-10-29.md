# VT Fresh Chicken — Application Test Report

**Date:** 2026-10-29
**Target:** https://vtchicken.mohammedshahid.in (production deployment)
**Method:** End-to-end API testing (superadmin + two throwaway customer accounts, deleted after testing), storefront HTML inspection, and codebase verification.

**Store state at test time:** setup complete, 17 products, 4 categories, 1 branch (Main Branch, Malappuram ~50 km service area), 6 currencies, all 6 modules enabled, real orders present.

---

## 1. Bugs Found (live-verified)

### 1.1 Critical — Price tampering (orders at arbitrary prices)

`POST /api/cart/items` trusts the client-supplied `unit_price`, and checkout prices the order from `cart_items` without re-validating against the database.

- **Proven live:** added a ~₹748 whole chicken with `unit_price: 1`, placed a COD order totalling ₹1 + ₹5.99 shipping. Order created successfully.
- The frontstore itself sends `unit_price` (`frontstore/src/lib/cart.tsx:49`), so this is the normal request path, not an edge case.
- **Fix:** always resolve price server-side from the DB at add-to-cart, and re-verify prices inside `PlaceOrder` before creating the order/payment.
- **Refs:** `backend/internal/handlers/cart.go` (AddItem), `backend/internal/services/store.go:2920` (AddToCart), `backend/internal/services/store.go:3699` (CreateOrderFromCart).

### 1.2 Critical — Order PII leak (IDOR)

`GET /api/orders/:orderId` has no auth middleware and no ownership check. Any order UUID returns full order details — shipping address, phone, email, items — both unauthenticated and when logged in as a different customer.

- **Fix:** require auth + ownership (customer), or a signed/expiring guest-tracking token.
- **Ref:** `backend/cmd/api/main.go:261` — `storeAPI.GET("/orders/:orderId", checkoutH.GetOrder)` (no `OptionalAuth`/ownership check).

### 1.3 Medium — `GET /api/inventory` returns 500

Default view and `?filter=products` fail with:

```
ERROR: column "product_id" does not exist (SQLSTATE 42703)
```

- The products leg of `ListInventoryPaged` selects `p.id` unaliased while the outer query expects `product_id`. `filter=all` and `filter=variants` work.
- Breaks the backoffice Inventory page / inventory report default view.
- **Ref:** `backend/internal/services/store.go:4441-4448`.

### 1.4 Medium — `POST /api/exports` returns 500

All export types fail with:

```
can't scan into dest[8]: cannot scan NULL into *string
```

Exports feature is unusable end-to-end (list/types/estimate work; creation fails).

### 1.5 Medium — Token refresh broken + unused

- `POST /api/auth/refresh` always returns `{"error":"EOF"}` — `auth.go` calls `ShouldBindJSON` twice on the same already-consumed request body (~line 197-209).
- Additionally, the frontstore never calls the refresh endpoint at all — customers are hard-logged-out when the 15-minute access token expires.
- **Ref:** `backend/internal/handlers/auth.go`, `frontstore/src/lib/api.ts`.

### 1.6 Low — `/sitemap.xml` returns 500

Returns a Next.js 500 error page. SEO impact.

### 1.7 Low — misc

| Issue | Detail |
|-------|--------|
| `/account` → 404 | No index page or redirect to `/account/login` / `/account/dashboard` |
| Return eligibility messaging | Non-delivered order returns contradictory flags (`return_eligible:false` but `*_allowed:true`); create-return error says "return period expired" instead of "order not delivered" |
| `PUT /api/products/:id` | Requires `slug` (full-replace binding); partial update → 400 |
| Security headers | No HSTS, CSP, X-Frame-Options, X-Content-Type-Options; `x-powered-by: Next.js` leaks stack |
| Rate limiting | 12 rapid failed logins → 12 × 401, no lockout/429 |

---

## 2. Verified Working

**Storefront**
- Pages: `/`, `/shop`, `/products/:slug` (OG tags + JSON-LD present), `/cart`, `/checkout`, `/orders`, `/account/*`, `/wishlist`, `/about`, `/contact`, `/privacy-policy`, `/terms`, `/cookie-policy`, `/p/:slug` builder pages, custom 404
- Filters: category, search, attribute (`?attr=storage:frozen`), price; pagination meta
- Multi-currency conversion (USD base → INR display)

**Commerce flow**
- Cart (session cookie + user), wishlist add/list, address book (checkout auto-saves)
- Checkout: COD, `WELCOME10` discount applied correctly, service-area gating (Kochi → 422, Manjeri → accepted), branch resolution by area and lat/lng, delivery/check endpoint
- Order lifecycle with transition validation: pending→paid→processing→shipped→delivered→fulfilled; invalid transitions rejected; notes; cancellation
- Returns: eligibility windows (30d refund / 15d replacement) → request with items → admin approve/reject
- Reviews: restricted to delivered orders (403 otherwise), auto-approved, verified badge, superadmin delete
- GDPR: `GET /api/me/export`, `DELETE /api/me/delete` both work

**Backoffice APIs**
- Dashboard stats, orders + counts, customers + stats, users/staff CRUD (staff can log in), permissions/roles, offers, discounts + stats, inventory stats, wallet, branches, delivery portal endpoints, payment gateways/transactions/stats, shipping methods, tax classes, contact submissions (submit/view/delete), page builder, modules, settings, SMTP settings
- RBAC: 401 unauthenticated, 403 wrong-role — enforced correctly
- Setup replay blocked (409); superadmin correctly rejected from store login (401); CORS locked down (no cross-origin headers)

---

## 3. Configuration / Deployment Issues

| Issue | Impact |
|-------|--------|
| **No transactional email** — SMTP disabled, 0 notification templates, 0 logs | Customers receive no order confirmation, shipping, or delivery emails |
| **All payment gateways in test/demo mode** — Razorpay `rzp_test_demo_key`, card/PayPal test mode | Only COD is effectively live |
| **Prices seeded in USD** (base_price $8.99 → ₹747.97 at rate 83.2) | Ugly non-round INR prices; orders carry USD-magnitude amounts labelled INR |
| **Generic shipping methods** — "Standard 3–5 days / Express 1–2 days", USD rates | Meaningless for a 50 km-radius fresh-meat store |
| **No `business_admin` account exists** | Store managed only via hidden `/backoffice/root-access` superadmin UI; `/backoffice/login` has no valid user |
| Tax/shipping zones & rates empty; no vendors; no shipping providers | Modules enabled but unconfigured — tax always computes 0 |
| Product images hotlink Unsplash | Unprofessional; can break anytime |
| `/shop` catalog is client-rendered (product names absent from HTML) | Weak SEO for category/listing pages (product detail pages are fine) |

---

## 4. Feature Gap Analysis

### 4.1 Must-have (before real launch)

| # | Feature | Status |
|---|---------|--------|
| 1 | Server-side price integrity at cart + checkout | **Missing — actively exploitable** |
| 2 | Order access control (ownership / signed tracking tokens) | Missing (IDOR) |
| 3 | Transactional email via SMTP + templates | Framework exists, unconfigured |
| 4 | Live Razorpay keys (UPI/cards/netbanking) | Present but demo-mode |
| 5 | Forgot-password / self-service reset | **No endpoint or UI at all** — locked-out customers have no recourse |
| 6 | Session refresh (fix endpoint, wire frontstore) | Broken + unused |
| 7 | Fix inventory 500, exports 500, sitemap 500 | Broken |
| 8 | Delivery slots / scheduled delivery | **Missing entirely** — fresh chicken needs same-day/time-slot delivery, not "3–5 business days" |
| 9 | Store timings, delivery hours, min-order value, per-area delivery fee | Partial (area gating exists; no slots/fees/minimums) |
| 10 | GST-compliant invoice PDF (invoice numbering, GSTIN, HSN codes) | Only a client-side print view exists |
| 11 | Catch-weight / variable-weight pricing | **Missing** — meat is sold by actual weight; fixed pack prices lose or overcharge money |
| 12 | Customer order notifications (WhatsApp/SMS for India) | Event types exist; no channel configured |
| 13 | Rate limiting on auth + checkout | Missing |
| 14 | Real product photography (hosted uploads) | Missing |

### 4.2 Nice-to-have

**Revenue**
- Subscriptions / recurring orders (daily chicken delivery)
- Wallet top-up promotions (wallet infrastructure exists)
- Referral / loyalty program
- Abandoned-cart recovery emails (event exists — needs email channel)
- COD fee / COD order limit
- Bulk / buy-more-save-more pricing

**Catalog (meat-specific)**
- Catch-weight SKUs (actual-weight billing)
- Cut instructions per order line ("curry cut", "skinless", "with bone")
- Recipe / marinade add-ons
- FSSAI licence + halal certification badges
- ₹/kg price display

**Customer experience**
- OTP / phone-number login
- WhatsApp order updates + support button
- Live delivery tracking map (delivery portal exists — extend to customer view)
- Order editing before cutoff time
- Substitute preferences for out-of-stock items

**SEO / growth**
- Server-render `/shop` catalog for SEO
- Fix sitemap.xml
- Review photos (customer image-upload endpoint already exists)
- Google Analytics / Meta pixel, server-side conversion events
- UTM-aware referral codes

**Operations**
- CSV product/customer **import** (exports exist but are broken)
- Admin audit log
- Low-stock email alerts to admin (event exists)
- Delivery-partner payout / settlement tracking
- Branch-level reporting
- Order print / packing slip, per-branch delivery manifest
- Review moderation gate (currently auto-approved)
- "Closed today" / store-holiday toggle

---

## 5. Priority Recommendation

1. **Fix criticals first** — price tampering (#1.1) and order IDOR (#1.2) are exploitable right now.
2. **Unblock operations** — SMTP + templates, live Razorpay keys, create a `business_admin` account, INR-native pricing, delivery slots.
3. **Fix medium bugs** — inventory, exports, sitemap, token refresh, forgot password.
4. **Meat-domain features** — catch-weight pricing, cut instructions, time slots — these are the difference between a generic store and a usable chicken delivery business.

---

## 6. Test Artifacts

All test data was cleaned up after testing:

- 2 test customer accounts → deleted via GDPR self-delete
- Test order 1 (price-tamper proof) → cancelled, marked TEST
- Test order 2 (lifecycle test) → driven to fulfilled, marked TEST
- Test return → rejected; test review → deleted
- Test products (×2), contact submissions (×2), test staff account → all deleted
