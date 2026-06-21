# Direct Sales (Wholesale) & Customers — Design Document

> **Status:** Design complete — implementation not started.
> **Last updated:** 2026-06-21
> **Purpose:** Single source of truth for the **direct sale** feature — the admin selling stock straight from the central warehouse to an outside customer/company, with negotiated pricing and customer tracking. Companion to `PURCHASING_DESIGN.md` and `MULTITENANT_DESIGN.md`.

---

## 1. Background & Goal

Today, sales only happen **store → customer**, recorded by a branch manager. The client also wants to sell **directly to an outside customer or company** — units leave the central **warehouse** without first being distributed to a store. This is a **wholesale / direct sale** channel.

```
Purchase → Warehouse ──┬── distribute → Store → manager sells to customer   (existing)
                       └── DIRECT SALE → outside customer / company          (new)
```

The good news: most of the machinery already exists. A direct sale is an **admin-initiated sale that draws from the warehouse**, costed with `averageCost` — and the system already does exactly that for no-stores orgs (`tenant-store-resolver.resolveSaleStoreId`). This feature opens that path to multi-store orgs, adds a **price override**, a **customer record**, and a **channel marker**.

---

## 2. Decisions Locked (confirmed with client 2026-06-21)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Stock source | **Warehouse only** (central pool) |
| 2 | Price | **Admin can override** the selling price (negotiation); defaults to `product.sellingPrice` |
| 3 | Customer | **Minimal `Customer` entity** — name + optional phone/email/note; pick-or-create inline |
| 4 | Who can do it | **Admin only**; branch managers keep selling at their stores |
| 5 | Reporting | **Channel marker** (`store` vs `direct`) so the two are distinguishable everywhere |
| 6 | Costing | Same as any sale — COGS snapshots `product.averageCost` |
| 7 | Below-cost price | **Warn, don't block** — admin can confirm (clearance/negotiation), mirroring purchases |
| 8 | Customer required on direct sale | **Yes** (you always want to know who bought); a "walk-in" fallback can be added later if needed |

---

## 3. Current State (grounded in code)

- **`tenant-store-resolver.resolveSaleStoreId`** — for an **admin** in a `hasStores = true` org it throws *"Sales must be submitted by a branch manager"*. For a `hasStores = false` org it returns the **warehouse**. Direct sales reuse this warehouse resolution but allow it for admins in any org.
- **`sales.service.create`** — locks inventory, checks stock, snapshots `unitPrice = sellingPrice` and `unitPurchasePrice = averageCost`, deducts inventory, writes audit. Direct sale reuses this shape, sourced from the warehouse, with an overridable `unitPrice` and a `customerId`.
- **`Sale`** model (`inventory.prisma`) — has `storeId` (the warehouse is a hidden store), `soldById`, `unitPrice`, `unitPurchasePrice`, `totalAmount`, `status`. No `customerId` or `channel` yet.
- **`sanitizeSaleForUser`** — strips cost from branch-manager responses; direct sales (warehouse) are already invisible to managers because `assertStoreAccess` blocks non-own-store access.
- **`CreateSaleDto`** — `productId`, `quantitySold`, `saleDate`, `note`. No price or customer fields yet.

---

## 4. Schema Changes

### 4.1 New `Customer` model

New file: `api/prisma/models/customer.prisma`

```prisma
model Customer {
  id             String       @id @default(cuid())
  name           String                          // company or person
  phone          String?
  email          String?
  note           String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdById    String
  createdBy      User         @relation("CustomersCreatedBy", fields: [createdById], references: [id])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  sales Sale[]

  @@index([organizationId])
  @@index([name])
  @@map("customer")
}
```

> Add `customers Customer[]` relations to `Organization` and `User` (`@relation("CustomersCreatedBy")`).
> Add `"Customer"` to `TENANT_MODELS` in `tenant-scoping.extension.ts`.
> No unique constraint on `name` — two customers may share a name; the pick-or-create UI shows existing matches.

### 4.2 `Sale` — add channel + customer

```prisma
enum SaleChannel {
  store
  direct
}

model Sale {
  // ... existing fields ...
  channel    SaleChannel @default(store)   // existing rows become `store`
  customerId String?
  customer   Customer?   @relation(fields: [customerId], references: [id])

  @@index([channel])
  @@index([customerId])
}
```

- `channel = store` — sale made by a branch manager at a store (today's behavior).
- `channel = direct` — admin sale from the warehouse to an outside customer.
- `customerId` — set for direct sales; null for store sales.

### 4.3 New `AuditAction` values (optional)

Reuse `SALE_CREATED` / `SALE_CORRECTED` for direct sales (they're still sales). Add customer actions:

```prisma
enum AuditAction {
  // ... existing ...
  CUSTOMER_CREATED
  CUSTOMER_UPDATED
}
```

---

## 5. Flows

### 5.1 Direct sale — `POST /api/sales/direct` (admin only)

1. Validate product (org-scoped, active).
2. Resolve the org **warehouse** (`ensureOrgWarehouse`) — this is the stock source.
3. Resolve customer: `customerId` must reference an existing customer in the org (the UI creates one first if new — see §5.3).
4. Determine selling price: `unitPrice = dto.unitPrice ?? product.sellingPrice`.
5. If `unitPrice < product.averageCost` and not `acceptSellingBelowCost` → **reject with a warning** the admin can confirm.
6. In a transaction (lock warehouse + product inventory row):
   - Check warehouse `quantity >= quantitySold`; else reject.
   - `unitPurchasePrice = product.averageCost` (COGS snapshot).
   - `totalAmount = unitPrice × quantitySold`.
   - Create `Sale` with `channel = direct`, `storeId = warehouse.id`, `customerId`, `soldById = admin.id`, `status = active`.
   - Decrement warehouse inventory.
   - Write `SALE_CREATED` + `INVENTORY_UPDATED` audit.
7. Return the sale (with product + customer).

> A direct sale **reduces warehouse stock**, so there is less to distribute to stores. That is correct and intended.

### 5.2 Direct sale correction — `PATCH /api/sales/:id/correct` (admin, direct sales)

Mirror the existing store-sale correction, but admin-scoped and restocking the **warehouse**:
- Only `active` direct sales; writes a `SaleCorrection`; adjusts warehouse inventory by the delta; never re-pulls `averageCost` (keeps the original COGS snapshot).

### 5.3 Customer pick-or-create

- **`POST /api/customers`** (admin) — create a customer (name + optional phone/email/note).
- **`GET /api/customers?search=`** (admin) — type-ahead list for the direct-sale form.
- **`GET /api/customers/:id`** (admin) — detail.
- **`PATCH /api/customers/:id`** (admin) — edit.
- **`GET /api/customers/:id/sales`** (admin) — that customer's direct-sale history.

The direct-sale form lets the admin **pick an existing customer or create a new one inline**: if new, the UI calls `POST /customers`, then submits the direct sale with the returned `customerId`. Keeps the sale endpoint simple (just needs `customerId`).

---

## 6. Backend Changes — File by File

### 6.1 Schema / Prisma
- [ ] New `customer.prisma` (§4.1); `Sale` gains `channel` + `customerId` (§4.2); `SaleChannel` enum
- [ ] `Organization`, `User` relations for `customers`
- [ ] `tenant-scoping.extension.ts` — add `"Customer"` to `TENANT_MODELS`
- [ ] Migration: create `customer` table; add `sale.channel` (default `store`), `sale.customerId`; add enum(s)

### 6.2 New `customers` module
- [ ] `api/src/modules/customers/` — module, controller (`@Roles(admin)`), service
- [ ] `create`, `findAll` (search), `findOne`, `update`, `findSales(customerId)`
- [ ] DTOs: `create-customer.dto.ts`, `update-customer.dto.ts`, `customer-query.dto.ts`
- [ ] Register in `AppModule`

### 6.3 `tenant-store-resolver.service.ts`
- [ ] Add `resolveDirectSaleStoreId(user)` — admin only; returns the org warehouse (active) regardless of `hasStores`. (Reuses the existing warehouse-resolution branch, lifting the multi-store block for the direct path.)

### 6.4 `sales` module
- [ ] `dto/create-direct-sale.dto.ts` — `productId`, `quantitySold`, `saleDate`, `customerId`, optional `unitPrice`, optional `acceptSellingBelowCost`, optional `note`
- [ ] `sales.service.ts` — `createDirect(dto, user)` (the §5.1 flow); reuse `lockInventoryForMutation`, `averageCost` COGS, audit pattern
- [ ] `sales.service.ts` — `correct(...)` adjustments so admins can correct **direct** sales (warehouse restock); keep store-sale corrections manager-only
- [ ] `sales.controller.ts` — `POST /sales/direct` (`@Roles(admin)`)
- [ ] `sales.service.ts` `findAll` — accept a `channel` filter and `customerId` filter; ensure direct sales are admin-visible and remain hidden from managers (warehouse store already blocks them)

### 6.5 `reports` module
- [ ] Add a **channel breakdown** (store vs direct) to dashboard/financial summaries
- [ ] Allow reports to filter by `channel`; direct sales still roll into total revenue / COGS / profit
- [ ] New raw SQL (if any) must include `organizationId` (tenant rule)

---

## 7. Frontend Changes

### 7.1 New: Direct Sale screen (admin)
- [ ] **Direct Sale form**: product picker (shows **warehouse** stock), quantity, **price field pre-filled with `sellingPrice` but editable**, customer pick-or-create, date, note
- [ ] Live preview: line total; gentle **"below average cost"** warning with a confirm checkbox when the price is under cost
- [ ] Customer **type-ahead**: search existing or "＋ Add new customer" inline (name + optional phone/email/note)

### 7.2 New: Customers (admin)
- [ ] Customers list + search
- [ ] Customer detail with their **direct-sale history** and totals
- [ ] Create / edit customer

### 7.3 Sales views
- [ ] Sales list: a **channel column/filter** (Store vs Direct) and a customer column for direct sales
- [ ] Admin can view & correct direct sales; managers' views are unchanged (and never show direct/warehouse sales)

### 7.4 Types & hooks
- [ ] `Customer` types; `Sale` gains `channel`, `customer`
- [ ] TanStack Query hooks for `/api/customers` and `/api/sales/direct`

---

## 8. Reporting

| Metric | Behavior |
|--------|----------|
| Revenue / COGS / profit | **Include** direct sales (they're real sales) |
| Channel breakdown | New: revenue & units split **Store vs Direct** |
| Sales by customer | Totals and history per `customerId` (direct sales) |
| Stock value / on-hand | Direct sales reduce **warehouse** stock; already reflected in inventory |

---

## 9. Phased Checklist

### Phase 1 — Schema & migration
- [ ] `customer.prisma`; `Sale.channel` + `Sale.customerId`; `SaleChannel` enum; relations; `TENANT_MODELS`
- [ ] Migration (channel defaults `store` for existing rows); `prisma generate`

### Phase 2 — Customers backend
- [ ] `customers` module (CRUD + search + per-customer sales), admin-only, tenant-scoped

### Phase 3 — Direct sale backend
- [ ] `resolveDirectSaleStoreId`
- [ ] `createDirect` service + `POST /sales/direct` controller (price override, below-cost confirm, warehouse stock check, averageCost COGS, audit)
- [ ] Direct-sale correction path (admin, warehouse restock)
- [ ] `findAll` channel + customer filters

### Phase 4 — Reports
- [ ] Channel breakdown; channel/customer filters; direct sales counted in totals

### Phase 5 — Frontend
- [ ] Direct Sale screen (price override + customer pick-or-create + below-cost warning)
- [ ] Customers list/detail/history
- [ ] Channel column/filter in sales views; types + hooks

### Phase 6 — Testing
- [ ] Admin direct sale from warehouse: stock deducts, COGS = averageCost, total uses override price
- [ ] Below-cost price: blocked without confirm, allowed with confirm
- [ ] Customer pick-or-create; per-customer history correct
- [ ] Warehouse stock guard: direct sale rejected when warehouse short
- [ ] Manager **cannot** see or create direct sales; managers' store flow unchanged
- [ ] Reports: direct sales in totals; store-vs-direct breakdown correct
- [ ] Cross-tenant: customers and direct sales never leak across orgs
- [ ] Correction of a direct sale restocks the warehouse and keeps the original COGS snapshot

---

## 10. Things to Be Careful About

1. **Direct sales draw from the warehouse, not a store.** Lock the warehouse inventory row and check its quantity — don't accidentally read a store's stock.
2. **Channel default = `store`.** The migration must default existing sales to `store` so historical reports are unchanged.
3. **Managers must never see direct sales.** They're warehouse sales; `assertStoreAccess` already blocks non-own-store access, but verify the sales list/report filters don't leak warehouse rows to managers.
4. **Keep the COGS snapshot on correction.** A direct-sale correction must not re-pull `averageCost`; it edits quantity/total only (same rule as store sales).
5. **Price override is on the sale, not the product.** Overriding the price for one customer must **not** change `product.sellingPrice` for everyone.
6. **Below-cost guard mirrors purchases** — warn + confirm (`acceptSellingBelowCost`), never hard-block (negotiation/clearance).
7. **Warehouse stays hidden as a "store".** Direct sales reference the warehouse `storeId`, but the warehouse must remain hidden from store pickers, store dashboards, and manager views.
8. **Customer is org-scoped.** The pick-or-create search and all customer reads must be tenant-filtered (handled by the extension once `Customer` is in `TENANT_MODELS`).

---

## 11. Open Decisions to Confirm Before Phase 1

- [ ] **No-stores orgs:** today their admin sales already come from the warehouse with `channel = store` (default). Do we **re-label** those as `direct` (they have no stores), or leave them as-is and treat `/sales/direct` purely as the multi-store wholesale path? (Recommendation: leave existing behavior; `channel = direct` only via the new endpoint — least disruptive.)
- [ ] **Customer history page:** build the per-customer sales history now, or ship direct sales first and add the history view in a fast follow? (Recommendation: include a basic list now; it's cheap once `customerId` exists.)
- [ ] **Direct-sale corrections:** include in the first build (recommended) or defer? Parity with store sales is nicer but adds a little scope.
