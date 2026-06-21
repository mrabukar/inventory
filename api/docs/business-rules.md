# Business Rules Reference

This document describes the **business rules enforced by the NestJS API** today: what is allowed, what is blocked, and how money, dates, and access control work. It also records **known gaps** where the original design (`system-design.md`) expects more than the API currently delivers.

**For the authoritative operational playbook** (workflows, prerequisites, action order — intended for frontend and operators), see **[`system-behavior-guide.md`](./system-behavior-guide.md)**.

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

### Store scoping (service layer)

Branch managers may only access their assigned store (`user.storeId`). Admins are not restricted by store.

Shared helpers in **`src/common/utils/store-scope.util.ts`** — call these from services after auth has attached `user`:

| Helper | Use |
|--------|-----|
| `assertStoreAccess(storeId, user)` | Path/query store must match manager's store (403 if not) |
| `resolveStoreFilter(user, queryStoreId?)` | List queries: admin may filter; manager always gets their store |
| `requireManagerStore(user)` | Read-only manager paths (dashboard, sales history) — **inactive store allowed** |
| `requireActiveManagerStore(user, findStore)` | Manager **mutations** — assigned store must be **active** (403 if inactive) |

**Where applied:**

| Module | Check |
|--------|--------|
| Inventory | `assertStoreAccess` on `:storeId` in path |
| Sales list | `assertStoreAccess` if manager passes `?storeId=`; then `resolveStoreFilter` |
| Sales get by id | `assertStoreAccess` on the sale's `storeId` |
| Sales create / correct | `requireActiveManagerStore` — blocked when store is inactive |
| Manager dashboard | `requireManagerStore` — works even when store is inactive (read-only snapshot) |

Admin-only modules (stores, products, stock supply, expenses) rely on `@Roles` only.

---

## 2. Authentication & user lifecycle

### Sign-in

- Email + password via Better Auth (`POST /api/auth/sign-in/email`).
- **Inactive users** (`isActive: false`) are rejected at sign-in with a generic unauthorized response.
- **Inactive assigned store** does **not** block sign-in — branch managers may log in to view dashboard and sales history; store **mutations** are blocked separately (see [§7](#7-sales--corrections)).
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
| Deactivate | Admin only. Soft delete (`isActive: false`). Audited as `STORE_DEACTIVATED`. **Blocked** if any **active branch manager** is still assigned, or if any inventory at the store has `quantity > 0`. Reassign/deactivate managers and clear stock first. |
| Reactivate | Admin only. `PATCH /stores/:id/reactivate`. Store must be inactive. Name must remain unique among **active** stores. Audited as `STORE_REACTIVATED`. |

---

## 4. Products & categories

### Product categories

- Seeded lookup table. **`GET /categories`** only — no create/update/delete API.
- Any authenticated user may list categories.

### Products (admin only)

| Rule | Detail |
|------|--------|
| Create | Requires valid `categoryId`. `sellingPrice` must be a positive decimal (max 2 places). **Cost is not set here** — new products start at `averageCost = 0` and gain a cost from their first **purchase**. Name max 150 chars. |
| Name uniqueness | Among **active** products only, compared via normalized name (case/spacing insensitive). |
| Update | Audited as `PRODUCT_UPDATED`. Renaming re-checks active-name uniqueness. |
| Deactivate | Soft delete. Audited as `PRODUCT_DEACTIVATED`. **Blocked** if any store has `quantity > 0` unless body includes `{ "force": true }` (forced deactivations record remaining stock in audit). Rows with `quantity === 0` do not block. |
| Reactivate | Allowed if no other **active** product has the same normalized name. Audited as `PRODUCT_REACTIVATED`. |
| Active-only reads | `findOne` and supply/sale flows require `isActive: true`. Admin inventory and **correction subtract** may use inactive products (see [§5](#5-inventory)). |

**Price validation:** `sellingPrice` must be a **positive** decimal on create and update. There is **no** product-level `sellingPrice ≥ purchasePrice` check anymore — cost is not stored on the product. The selling-below-cost guard now runs at **purchase** time, comparing the new selling price against the purchase unit cost (admin can confirm to override). Historical sale snapshots are unchanged.

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
- **`GET /inventory`** — paginated list across stores. Admin: optional `?storeId=` (omit for all active stores). Manager: always scoped to assigned store (`storeId` query param ignored after access check if mismatched).
- **`GET /inventory/stores/:storeId`** — same list shape, store in path (equivalent to `GET /inventory?storeId=` for admins).
- List filters:
  - **Managers:** **active products** only (`product.isActive: true`).
  - **Admins:** active products **plus** inactive products with **`quantity > 0`** (discontinued stock after `force` deactivate). Response includes `product.isActive` for UI labeling.
  - **Active stores** only (`store.isActive: true`).
  - Optional: `categoryId`, `search`, `lowStockOnly`.
- `lowStockOnly`: rows where `quantity > 0` and `quantity <= lowStockThreshold` (excludes out-of-stock). Prefer dedicated alert endpoints below for paginated low/out-of-stock tables.
- **Get one** (`GET .../products/:productId`): admins may fetch inventory for inactive products; managers require an active product.

### Stock alert lists

Dedicated paginated endpoints (admin + branch manager). **Active products and active stores only** — same rules as dashboard counts.

| Endpoint | Rows included |
|----------|----------------|
| `GET /inventory/low-stock` | `quantity > 0` and `quantity <= lowStockThreshold` |
| `GET /inventory/out-of-stock` | `quantity = 0` |

Query params: `page`, `limit`, optional `search`, `categoryId`, and optional `storeId` (**admin only** — omit for all stores). Managers are always scoped to their assigned store; a mismatched `storeId` returns **403**.

Dashboard stat cards use `summary.lowStockCount` / `summary.outOfStockCount` from `/reports/*-dashboard`; load these list endpoints for alert tables.

### Low stock threshold

- Default **5** on each inventory row (`lowStockThreshold` column).
- Used in inventory list filter, admin/manager dashboards, and reports.
- **Admin only:** `PATCH /inventory/stores/:storeId/products/:productId/threshold` with `{ "lowStockThreshold": number }` (integer `>= 0`). Works for inactive products when an inventory row exists. Audited as `INVENTORY_UPDATED` (threshold fields only in old/new values). Quantity is **not** changed by this endpoint.

**Reports:** stock value and low-stock metrics still count **active products only** (orphan discontinued stock is excluded from dashboard totals).

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

Admin only. Stock supply is **distribution** — it moves stock from the organization's central **warehouse** to a store (the warehouse is filled by purchases). Cost is set at **purchase** time, not here. See [`stock-supply-design.md`](./stock-supply-design.md) for full detail.

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
| Active product & store | Normal supply and correction **add** require an **active** product and store. **Correction subtract** allows an **inactive** product (clear discontinued stock). |
| Quantity | Must be **non-zero**. Normal/correction DTOs require **positive** input; subtract endpoint negates internally. |
| Note | **Optional** on normal supply. **Required** on corrections (max 500 chars). |
| `correctsSupplyId` | Optional on corrections. If provided, referenced supply must exist and match the **same product and store**. |
| `unitPurchasePrice` | **Reference only** — recorded as the product’s current `averageCost` at distribution time. Not a cost source for profit and not admin-editable; cost is set at **purchase** time. |
| Warehouse stock | A distribution is rejected if the warehouse has fewer units than requested. The destination store may **not** be the warehouse itself. |
| Audit | Each supply writes `STOCK_SUPPLIED` plus `INVENTORY_UPDATED`. |

Negative inventory adjustments are **only** allowed through `correction_subtract`, not through the normal supply endpoint.

---

## 7. Sales & corrections

### Who can do what

| Action | Admin | Branch manager |
|--------|:-----:|:--------------:|
| List sales | ✓ (optional `storeId` filter) | ✓ (forced to own store) |
| Get sale by id | ✓ (any store) | ✓ (own store only) |
| Submit sale | ✗ | ✓ (assigned store must be **active**) |
| Correct sale | ✗ | ✓ (own store only; store must be **active**) |

### Get sale (`GET /sales/:id`)

| Rule | Detail |
|------|--------|
| Access | Admin: any sale. Manager: sale must belong to their `storeId` (`assertStoreAccess`). |
| Response | Same shape as list rows — product (with category), store, soldBy, corrections (newest first). |
| Not found | `404` if id does not exist, or manager requests another store’s sale. |

### Submit sale (`POST /sales`)

| Rule | Detail |
|------|--------|
| Active store | Manager's assigned store must be **active** (`isActive: true`). Otherwise **403**. |
| Product | Must be **active** and have an **inventory row** at the manager’s store. |
| Quantity | Integer, **positive** (`@IsPositive`). |
| Stock check | Rejected if `quantitySold > inventory.quantity`. |
| Sale date | **Today** or up to **7 days in the past** (inclusive), using `APP_TIMEZONE`. Future dates rejected. |
| Price snapshot | `unitPrice` = product’s current `sellingPrice`; `unitPurchasePrice` = product’s current `averageCost` (weighted-average cost). Stored on the sale row permanently. |
| `totalAmount` | `unitPrice × quantitySold`. |
| Status | Created as `active`. |
| Audit | `SALE_CREATED` and `INVENTORY_UPDATED`. |

### Sale correction (`PATCH /sales/:id/correct`)

| Rule | Detail |
|------|--------|
| Active store | Same as submit sale — assigned store must be **active**. |
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
| COGS | Sum of `quantitySold × unitPurchasePrice` — the weighted-average cost (`averageCost`) snapshotted on each sale row |
| Gross profit | Revenue − COGS |
| Expenses | By `expenseDate`; store filter applies per rules above |
| Stock investment (period) | Sum of `purchase.totalCost` where `purchaseDate` falls in period (money paid to vendors) |
| Current stock value (live) | Sum of `inventory.quantity × product.averageCost` (moving weighted-average cost × on-hand qty) |
| Low stock count | Inventory rows where `quantity > 0` and `quantity <= lowStockThreshold` (active products/stores) |
| Out of stock count | Inventory rows where `quantity = 0` (active products/stores; row must exist) |

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

### 12.9 Central store-scoping helpers

**Design:** Consistent store-scoped access for branch managers.

**Current state:** Shared utils in `src/common/utils/store-scope.util.ts`; each store-scoped **service** calls them (no global guard). See [§1 Store scoping](#store-scoping-service-layer).

### 12.10 Dedicated tabular report endpoints

**Design:** Separate report pages (inventory table, sales profit table, supply history, etc.).

**Current state:** Aggregated **`/reports/*`** dashboards plus **paginated list APIs** (`/inventory`, `/sales`, `/stock-supplies`, `/expenses`) serve most tabular needs. No separate `/reports/inventory-table`-style routes.

**Impact:** Frontend should compose list endpoints + dashboards rather than expecting one report endpoint per screen in the design doc.

---

## 13. Gaps: behavior holes (not in design, or design silent)

These are **observed behaviors** that the design doc does not clearly require (or is silent on) but may surprise operators. Decide whether to **fix in code** or **accept and document** (this section documents as-is).

### ~~13.1 Product deactivate allowed while stock remains~~ ✓ Resolved

Block by default when any store has `quantity > 0`. Override with `PATCH /products/:id/deactivate` body `{ "force": true }`. Audit records `forcedDespiteStock` and per-store quantities when forced.

### ~~13.2 Store deactivate without guard rails~~ ✓ Resolved

Deactivate blocked when active branch managers are assigned or when the store has inventory with `quantity > 0`.

### ~~13.3 Sales and corrections at deactivated stores~~ ✓ Resolved

`POST /sales` and `PATCH /sales/:id/correct` use `requireActiveManagerStore` — **403** when the manager's assigned store is inactive. `GET /sales` and the manager dashboard remain available (read-only).

### ~~13.4 Managers at deactivated stores can still sign in~~ ✓ Resolved (by design)

Sign-in is **not** blocked when the assigned store is inactive. Managers can log in and view dashboard / sales history; they cannot submit or correct sales until the store is reactivated or they are reassigned (see [§13.2](#132-store-deactivate-without-guard-rails)).

### ~~13.5 No validation that selling price ≥ purchase price~~ ✓ Resolved (now enforced at purchase time)

Product create/update no longer compares selling price to a product cost (products have no cost field). The selling-below-cost guard runs at **purchase** time: recording a purchase — or updating the selling price from the purchase screen — rejects a selling price below the purchase unit cost unless the admin confirms the override.

### ~~13.6 No `GET /sales/:id` detail endpoint~~ ✓ Resolved

`GET /api/sales/:id` — admin or branch manager (own store). Returns full sale with product, store, soldBy, and corrections.

### ~~13.7 Deactivated product inventory visibility~~ ✓ Resolved

**Admins:** inventory list includes inactive products when `quantity > 0`; get-one and threshold PATCH work for inactive products. **Managers:** active products only. **Correction subtract** works on inactive products to clear orphan stock. Dashboard stock metrics remain active-product-only.

## 14. Related documentation

| Document | Contents |
|----------|----------|
| [`system-behavior-guide.md`](./system-behavior-guide.md) | **Operational playbook** — workflows, prerequisites, full behavior spec |
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
