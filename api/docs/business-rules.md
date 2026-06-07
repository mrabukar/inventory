# Business Rules Reference

This document describes the **business rules enforced by the NestJS API** today: what is allowed, what is blocked, and how money, dates, and access control work. It also records **known gaps** where the original design (`system-design.md`) expects more than the API currently delivers.

For implementation patterns (DTOs, controllers, audit), see [`modules-implementation-guide.md`](./modules-implementation-guide.md). For module-specific detail, see [`stock-supply-design.md`](./stock-supply-design.md) and [`reports-module.md`](./reports-module.md).

_Last updated: 2026-06-06_

---

## Table of Contents

1. [Roles & access](#1-roles--access)
2. [Authentication & user lifecycle](#2-authentication--user-lifecycle)
3. [Stores](#3-stores)
4. [Products & categories](#4-products--categories)
5. [Inventory](#5-inventory)
6. [Stock supply](#6-stock-supply)
7. [Sales & corrections](#7-sales--corrections)
8. [Expenses](#8-expenses)
9. [Reports & dashboards](#9-reports--dashboards)
10. [Audit log](#10-audit-log)
11. [Cross-cutting rules](#11-cross-cutting-rules)
12. [Gaps: designed but not fully implemented](#12-gaps-designed-but-not-fully-implemented)
13. [Gaps: behavior holes (not in design, or design silent)](#13-gaps-behavior-holes-not-in-design-or-design-silent)
14. [Related documentation](#14-related-documentation)

---

## 1. Roles & access

### Roles

| Role | Scope |
|------|--------|
| **admin** | Company-wide. No `storeId`. |
| **branch_manager** | Single assigned store via `user.storeId`. |

### Default security

- Every route requires a valid Better Auth session **unless** marked `@AllowAnonymous()` (health, auth endpoints).
- Global rate limit: **100 requests/minute** per client.
- Role checks use `@Roles(...)` on controllers or methods.

### Module access matrix

| Module | Admin | Branch manager |
|--------|:-----:|:--------------:|
| Auth (sign-in, sign-out, session) | ✓ | ✓ |
| Users | ✓ | ✗ |
| Stores | ✓ | ✗ |
| Products | ✓ | ✗ |
| Product categories (`GET /categories`) | ✓ | ✓ |
| Expense categories | ✓ | ✗ |
| Stock supply | ✓ | ✗ |
| Inventory (read) | ✓ (any store) | ✓ (own store only) |
| Inventory (update threshold) | ✓ | ✗ |
| Sales (list) | ✓ (optional store filter) | ✓ (own store only) |
| Sales (create / correct) | ✗ | ✓ |
| Expenses | ✓ | ✗ |
| Audit log | ✓ | ✗ |
| Admin dashboard / financial summary / product distribution | ✓ | ✗ |
| Manager dashboard | ✗ | ✓ |

Store scoping for managers is enforced **inside each service** (e.g. `assertStoreAccess`, `resolveStoreFilter`). There is no shared `StoreScopeGuard` yet.

---

## 2. Authentication & user lifecycle

### Sign-in

- Email + password via Better Auth (`POST /api/auth/sign-in/email`).
- **Inactive users** (`isActive: false`) are rejected at sign-in with a generic unauthorized response.
- Session cookie: `better-auth.session_token`.
- Session lifetime: **1 hour** (`expiresIn` and cookie cache in auth config).
- Password minimum length: **8 characters**, plus strength rules (see below).

### Sign-up (user creation)

There is **no** `POST /api/users`. All user creation goes through **`POST /api/auth/sign-up/email`**.

| Policy | Behavior |
|--------|----------|
| `ALLOW_SIGNUP=true` | Bootstrap mode: sign-up allowed **without** an admin session (for first admin in prod). |
| `ALLOW_SIGNUP=false` | Admin-only: caller must have a valid **admin** session. |
| `ALLOW_SIGNUP` unset | **Development**: bootstrap allowed. **Production**: admin-only. |

Sign-up validation (auth hooks):

- `role` must be `admin` or `branch_manager`.
- **Admin**: `storeId` must **not** be sent.
- **Branch manager**: `storeId` is **required** and must reference an **active** store.
- Password must pass strength validation (uppercase, digit, special character).
- `emailAndPassword.autoSignIn: false` — creating a user does **not** replace the admin’s session.
- New users are created with `isActive: true`.
- A `USER_CREATED` audit entry is written (actor = admin session user, or the new user in bootstrap mode).

### User management (admin)

| Action | Rule |
|--------|------|
| List / get / update | Admin only |
| Deactivate | Cannot deactivate **your own** account. All sessions for that user are deleted. |
| Activate | User must currently be inactive. If role is branch manager, assigned store must still be **active**. |
| Update role → admin | `storeId` is cleared automatically. |
| Update role → branch manager | `storeId` required (explicit or retained). Store must be active. |
| Change email | Must remain unique. |
| Change password | Min 8 chars + same strength rules as sign-up. |

---

## 3. Stores

| Rule | Detail |
|------|--------|
| Create | Admin only. Store name must be unique among **active** stores. |
| List / get | Admin only. List and `findOne` return **active** stores only. |
| Update | Admin only. Audited as `STORE_UPDATED`. |
| Deactivate | Admin only. Soft delete (`isActive: false`). Audited as `STORE_DEACTIVATED`. |
| Reactivate | Admin only. `PATCH /stores/:id/reactivate`. Store must be inactive. Name must remain unique among **active** stores. Audited as `STORE_REACTIVATED`. |

---

## 4. Products & categories

### Product categories

- Seeded lookup table. **`GET /categories`** only — no create/update/delete API.
- Any authenticated user may list categories.

### Products (admin only)

| Rule | Detail |
|------|--------|
| Create | Requires valid `categoryId`. `purchasePrice` and `sellingPrice` must be positive decimals (max 2 places). Name max 150 chars. |
| Name uniqueness | Among **active** products only, compared via normalized name (case/spacing insensitive). |
| Update | Audited as `PRODUCT_UPDATED`. Renaming re-checks active-name uniqueness. |
| Deactivate | Soft delete. Audited as `PRODUCT_DEACTIVATED`. **Does not check** remaining inventory (see [§13](#13-gaps-behavior-holes-not-in-design-or-design-silent)). |
| Reactivate | Allowed if no other **active** product has the same normalized name. Audited as `PRODUCT_REACTIVATED`. |
| Active-only reads | `findOne` and supply/sale flows require `isActive: true`. |

**Price validation:** There is **no** rule that `sellingPrice >= purchasePrice`. Both must only be positive.

---

## 5. Inventory

Inventory rows represent **live quantity** per product–store pair. Quantity is **never** updated via a direct inventory PATCH endpoint.

### How quantity changes

| Event | Effect |
|-------|--------|
| Stock supply (positive) | Creates row if missing, or increases quantity |
| Stock correction subtract | Decreases quantity (stored as negative supply qty) |
| Sale | Decreases quantity |
| Sale correction (increase qty sold) | Further decreases quantity |
| Sale correction (decrease qty sold) | Increases quantity |

### Read rules

- Admin may read any store; manager may read **only** their assigned store.
- List filters:
  - **Active products** only (`product.isActive: true`).
  - **Active stores** only (`store.isActive: true`).
  - Optional: `categoryId`, `search`, `lowStockOnly`.
- `lowStockOnly`: rows where `quantity <= lowStockThreshold`.

### Low stock threshold

- Default **5** on each inventory row (`lowStockThreshold` column).
- Used in inventory list filter, admin/manager dashboards, and reports.
- **Admin only:** `PATCH /inventory/stores/:storeId/products/:productId/threshold` with `{ "lowStockThreshold": number }` (integer `>= 0`). Requires an existing inventory row; active product and store. Audited as `INVENTORY_UPDATED` (threshold fields only in old/new values). Quantity is **not** changed by this endpoint.

### Stock cannot go negative

Before any deduction (sale, sale correction increase, correction subtract), the service checks that the result would not be `< 0`. Violations return `400 Bad Request`.

PostgreSQL also enforces **`CHECK (quantity >= 0)`** on `inventory` (migration `20260606210000_inventory_quantity_non_negative`).

### Concurrency (row-level locking)

All quantity mutations (sales, sale corrections, stock supply) run inside a database transaction and call `lockInventoryForMutation()` before read–modify–write:

1. **`pg_advisory_xact_lock`** on the product–store pair — serializes concurrent mutations, including first-time inventory row creation.
2. **`SELECT … FOR UPDATE`** on the existing inventory row — row-level lock while quantity is read and updated.

See `src/common/utils/inventory-lock.util.ts`.

---

## 6. Stock supply

Admin only. See [`stock-supply-design.md`](./stock-supply-design.md) for full detail.

### Supply types

| Type | Endpoint | Quantity sign |
|------|----------|---------------|
| Normal supply | `POST /stock-supplies` | Positive input → positive stored |
| Correction add | `POST /stock-supplies/corrections/add` | Positive |
| Correction subtract | `POST /stock-supplies/corrections/subtract` | Positive input → **negative** stored internally |

### Rules

| Rule | Detail |
|------|--------|
| Immutability | Supply rows are **never edited or deleted**. Mistakes are fixed with correction endpoints. |
| Active product & store | Both must pass `findOne` (active only). |
| Quantity | Must be **non-zero**. Normal/correction DTOs require **positive** input; subtract endpoint negates internally. |
| Note | **Optional** on normal supply. **Required** on corrections (max 500 chars). |
| `correctsSupplyId` | Optional on corrections. If provided, referenced supply must exist and match the **same product and store**. |
| `unitPurchasePrice` | Optional. Defaults to product’s current `purchasePrice`. Admin may override (cost snapshot at supply time). |
| Audit | Each supply writes `STOCK_SUPPLIED` plus `INVENTORY_UPDATED`. |

Negative inventory adjustments are **only** allowed through `correction_subtract`, not through the normal supply endpoint.

---

## 7. Sales & corrections

### Who can do what

| Action | Admin | Branch manager |
|--------|:-----:|:--------------:|
| List sales | ✓ (optional `storeId` filter) | ✓ (forced to own store) |
| Submit sale | ✗ | ✓ |
| Correct sale | ✗ | ✓ (own store only) |

### Submit sale (`POST /sales`)

| Rule | Detail |
|------|--------|
| Product | Must be **active** and have an **inventory row** at the manager’s store. |
| Quantity | Integer, **positive** (`@IsPositive`). |
| Stock check | Rejected if `quantitySold > inventory.quantity`. |
| Sale date | **Today** or up to **7 days in the past** (inclusive), using `APP_TIMEZONE`. Future dates rejected. |
| Price snapshot | `unitPrice` = product’s current `sellingPrice`; `unitPurchasePrice` = product’s current `purchasePrice`. Stored on the sale row permanently. |
| `totalAmount` | `unitPrice × quantitySold`. |
| Status | Created as `active`. |
| Audit | `SALE_CREATED` and `INVENTORY_UPDATED`. |

### Sale correction (`PATCH /sales/:id/correct`)

| Rule | Detail |
|------|--------|
| Eligibility | Sale must belong to manager’s store and have status **`active`**. |
| Corrected quantity | Integer **`>= 0`**. Must **differ** from original `quantitySold`. |
| Reason | **Required** (max 500 chars). |
| Stock on increase | If corrected qty **exceeds** original, extra units are deducted; rejected if insufficient stock. |
| Status after correction | Sale becomes **`corrected`** — **cannot be corrected again**. |
| Price | `unitPrice` on the sale row is **unchanged**; `totalAmount` recalculated from stored unit price. |
| Wrong product workflow | Correct original sale to **quantity 0**, then submit a **new** sale for the correct product. |
| Audit | `SALE_CORRECTED` and `INVENTORY_UPDATED`. |

### Historical integrity

- `sales.storeId` and `soldById` are set at submission and **not updated** when a manager is reassigned.
- Changing product prices later does **not** alter existing sale rows.

---

## 8. Expenses

Admin only.

| Rule | Detail |
|------|--------|
| Scope | `storeId` optional — `null` = **company-wide** expense. |
| Store-scoped expense | If `storeId` provided, store must be **active**. |
| Expense date | **Today or past only** (no future dates). No maximum past limit (unlike sales). |
| Amount | Positive. |
| Categories | Must reference an existing expense category. |
| Update | Audited as `EXPENSE_UPDATED`. |
| Delete | **Hard delete** (not soft delete). Audited as `EXPENSE_DELETED`. |
| Manager access | Branch managers have **no** expense endpoints. |

### Expense categories (admin)

- Full CRUD except: **delete blocked** if any expense still references the category.

### Company-wide vs store P&L (reports)

- Company-wide expenses (`storeId = null`) are included in **company totals**.
- They are **excluded** from a **single-store** profit view (financial summary / store-scoped expense rollups).

---

## 9. Reports & dashboards

All report endpoints are **read-only**. No PDF/Excel export (see [§12](#12-gaps-designed-but-not-fully-implemented)).

| Endpoint | Role | Notes |
|----------|------|-------|
| `GET /reports/admin-dashboard` | Admin | Optional date range / store filter |
| `GET /reports/manager-dashboard` | Branch manager | Scoped to `user.storeId` |
| `GET /reports/financial-summary` | Admin | P&L-style aggregates |
| `GET /reports/product-distribution` | Admin | **`categoryId` required** — product breakdown within one category |

### Financial definitions (enforced in reports service)

| Metric | Definition |
|--------|------------|
| Revenue | Sum of `sales.totalAmount` for active + corrected sales in period (by `saleDate`) |
| COGS | Sum of `quantitySold × unitPurchasePrice` (snapshot on sale row) |
| Gross profit | Revenue − COGS |
| Expenses | By `expenseDate`; store filter applies per rules above |
| Stock investment (period) | Sum of `stock_supply.quantity × unitPurchasePrice` where `createdAt` falls in period |
| Current stock value (live) | Sum of `inventory.quantity × product.purchasePrice` using **today’s catalog cost**, not supply snapshots |
| Low stock count | Inventory rows where `quantity <= lowStockThreshold` (active products/stores) |

Period comparisons (e.g. vs previous month) use the same timezone-aware calendar logic as sale/expense dates. See [`reports-module.md`](./reports-module.md).

---

## 10. Audit log

- **Admin read-only** (`GET /audit-logs` with filters).
- **No delete or update** API — append-only from domain actions.
- Actions include: user/product/store lifecycle, stock supply, sales, inventory updates, expenses.

---

## 11. Cross-cutting rules

### Timezone

- `APP_TIMEZONE` (default `Africa/Mogadishu`) drives:
  - Sale date validation (today / 7-day window)
  - Expense date validation (no future)
  - Report period boundaries and dashboard comparisons

### Money

- Stored as `Decimal` in PostgreSQL; converted safely in services/reports (no floating-point drift in aggregates).

### Soft delete vs hard delete

| Entity | Delete style |
|--------|--------------|
| Users, products, stores | Soft delete (`isActive: false`) |
| Expenses | Hard delete |
| Stock supplies, sales, audit log | Immutable — no delete |

### Auth transport

- Cookie-based sessions (Better Auth), not JWT access/refresh tokens from the original design doc.
- Auth mutations require trusted `Origin` (configure `BETTER_AUTH_TRUSTED_ORIGINS` — include both frontend and API origins for Postman/browser).

### Transactions & inventory locking

- Sales, sale corrections, and stock supply run in **database transactions** (inventory + domain row + audit in one commit).
- Inventory quantity updates use **advisory locks + `FOR UPDATE`** before modifying quantity (see [§5](#5-inventory)).

---

## 12. Gaps: designed but not fully implemented

These items appear in `system-design.md` or early architecture notes but are **not fully delivered** in the current API.

### ~~12.1 Database `CHECK (quantity >= 0)` on inventory~~ ✓ Implemented

Added in migration `20260606210000_inventory_quantity_non_negative`. Application checks remain as the primary user-facing validation; the DB constraint is a backstop.

### ~~12.2 Row-level locking on inventory during sales~~ ✓ Implemented

`lockInventoryForMutation()` in `src/common/utils/inventory-lock.util.ts` is used by sales, sale corrections, and stock supply. Combines `pg_advisory_xact_lock` (product–store slot) with `SELECT … FOR UPDATE` on the inventory row.

### 12.3 Account lockout after failed login attempts

**Design:** After **5 consecutive failed** login attempts, lock the account for **15 minutes**.

**Current state:** Better Auth default sign-in only. **No lockout counter or timed ban** is implemented.

**Impact:** Brute-force resistance relies on rate limiting (100 req/min global) and password strength, not per-account lockout.

---

### 12.4 JWT access token (15 min) + refresh token (7 days)

**Design:** Short-lived JWT access token and long-lived refresh token in HTTP-only cookies.

**Current state:** **Better Auth session cookies** with ~**1 hour** session expiry. No separate refresh-token flow as described in the design doc.

**Impact:** Documentation and client expectations based on the old JWT model are outdated. Session renewal follows Better Auth behavior.

---

### 12.5 First admin via deployment seed script

**Design:** First admin created by a **one-time seed/bootstrap script** at deploy time; all later users created in-app by admins.

**Current state:** First admin is created via **`POST /api/auth/sign-up/email`** with `ALLOW_SIGNUP=true` (or open sign-up in development). No dedicated seed script in the repo.

**Impact:** Operators must set `ALLOW_SIGNUP=true` briefly in production, create the admin, then set `ALLOW_SIGNUP=false`. Process is env-driven rather than script-driven.

---

### ~~12.6 Configurable low-stock threshold per inventory row~~ ✓ Implemented

`PATCH /api/inventory/stores/:storeId/products/:productId/threshold` — admin only, body `{ "lowStockThreshold": 0 }` (integer `>= 0`). Audited as `INVENTORY_UPDATED`.

### ~~12.7 Store reactivate endpoint~~ ✓ Implemented

`PATCH /api/stores/:id/reactivate` — admin only. Rejects if store is already active or if another active store has the same name. Audited as `STORE_REACTIVATED`.

### 12.8 PDF / Excel report export

**Design:** Reports exportable as PDF or Excel.

**Current state:** JSON dashboard/report endpoints only. **No export** endpoints or file generation.

---

### 12.9 Central `StoreScopeGuard`

**Design (implicit):** Consistent store-scoped access for branch managers.

**Current state:** Each service implements its own checks (`assertStoreAccess`, `resolveStoreFilter`, `requireManagerStore`). Functionally correct for implemented modules, but **easy to miss** when adding new endpoints.

**Impact:** New modules must remember to scope manually; no compile-time/shared guard enforcement.

---

### 12.10 Dedicated tabular report endpoints

**Design:** Separate report pages (inventory table, sales profit table, supply history, etc.).

**Current state:** Aggregated **`/reports/*`** dashboards plus **paginated list APIs** (`/inventory`, `/sales`, `/stock-supplies`, `/expenses`) serve most tabular needs. No separate `/reports/inventory-table`-style routes.

**Impact:** Frontend should compose list endpoints + dashboards rather than expecting one report endpoint per screen in the design doc.

---

## 13. Gaps: behavior holes (not in design, or design silent)

These are **observed behaviors** that the design doc does not clearly require (or is silent on) but may surprise operators. Decide whether to **fix in code** or **accept and document** (this section documents as-is).

### 13.1 Product deactivate allowed while stock remains

**Expected by some operators:** Do not deactivate a product that still has quantity on hand at any store.

**Current state:** `PATCH /products/:id/deactivate` **does not check** inventory. Deactivation always succeeds for an active product.

**Impact:** Stock remains in `inventory` rows but the product disappears from active lists and cannot be sold or supplied until reactivated. Historical sales/supplies unchanged.

---

### 13.2 Store deactivate without guard rails

**Design:** Soft delete for stores.

**Current state:** Deactivate does **not** check for:
- branch managers still assigned to the store,
- non-zero inventory at the store.

**Impact:** Managers may remain assigned to an inactive store; inventory rows persist. See [§13.3](#133-sales-and-corrections-at-deactivated-stores).

---

### 13.3 Sales and corrections at deactivated stores

**Current state:** Sale create/correct uses the manager’s `user.storeId` but **does not verify** `store.isActive`. Supply and inventory **reads** require active stores; **writes** do not.

**Impact:** A manager assigned to a deactivated store can still submit sales and corrections if inventory rows exist.

---

### 13.4 Managers at deactivated stores can still sign in

**Current state:** Sign-in checks **user** `isActive`, not whether the assigned **store** is active.

**Impact:** Deactivating a store does not automatically block its managers from logging in and operating (see [§13.3](#133-sales-and-corrections-at-deactivated-stores)).

---

### 13.5 No validation that selling price ≥ purchase price

**Design:** Lists purchase and selling price separately; does not mandate margin.

**Current state:** Admin may set `sellingPrice` **below** `purchasePrice`.

**Impact:** Sales and profit reports remain mathematically correct but may show negative unit margin by configuration.

---

### 13.6 No `GET /sales/:id` detail endpoint

**Current state:** Sales are listed via `GET /sales` with pagination and filters. There is **no** get-by-id route.

**Impact:** Clients must find a sale in the list or query by filters; no direct fetch for a correction workflow UI unless added later.

---

### 13.7 Deactivated product inventory visibility

**Current state:** Inventory **list** hides inactive products. A direct inventory lookup for an inactive product still goes through `productsService.findOne`, which requires **active** product — so managers cannot fetch that row via normal API paths even if quantity > 0 in the database.

**Impact:** Orphan stock for deactivated products is invisible via API until the product is reactivated (or data is fixed in DB).

---

## 14. Related documentation

| Document | Contents |
|----------|----------|
| [`system-design.md`](../../system-design.md) | Original product/domain design (some auth/report details superseded) |
| [`modules-implementation-guide.md`](./modules-implementation-guide.md) | NestJS patterns, audit, pagination, soft delete |
| [`stock-supply-design.md`](./stock-supply-design.md) | Supply immutability, corrections, pricing snapshots |
| [`reports-module.md`](./reports-module.md) | Dashboard fields, comparison logic, query params |
| [`better-auth.md`](./better-auth.md) | Auth setup, Swagger, trusted origins |
| [`.env.example`](../.env.example) | `ALLOW_SIGNUP`, `APP_TIMEZONE`, `BETTER_AUTH_*` |

---

## Quick reference: environment variables affecting rules

| Variable | Effect on business rules |
|----------|-------------------------|
| `ALLOW_SIGNUP` | Controls bootstrap vs admin-only user creation |
| `APP_TIMEZONE` | Sale/expense date windows and report periods |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Required for browser/Postman auth mutations |
| `NODE_ENV` | With unset `ALLOW_SIGNUP`, production defaults to admin-only sign-up |
