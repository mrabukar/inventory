# Purchasing & Weighted-Average Cost — Design Document

> **Status:** Implemented (phased rollout complete 2026-06-21).
> **Last updated:** 2026-06-20
> **Purpose:** Single source of truth for the purchasing/procurement feature and moving weighted-average costing. Reference phase by phase and tick off items as completed. Companion to `MULTITENANT_DESIGN.md`.

---

## 1. Background & Goal

Today the app has no concept of **purchasing from a vendor**. Product cost is a single fixed number, and "stock supply" only distributes stock to a store. The client needs:

- A way to **purchase the same product over time at different costs** (e.g. Samsung 15/128GB: Jan @ 110, Feb @ 120) without creating duplicate products.
- Profit (COGS) that reflects what was **actually paid**, using **moving weighted-average** cost.
- The ability to **raise the selling price** when cost rises (manual, admin-controlled).
- A permanent **purchase history** per product.

---

## 2. Decisions Locked (Do Not Revisit Without Reason)

| Decision | Choice | Reason |
|----------|--------|--------|
| New concept | A **Purchase** record (procurement from vendor) | Distinct from store distribution; this is where real cost is set |
| Stock flow | Purchase → **central pool** → distribute to stores | Matches how the business actually buys then sends out |
| Central pool mechanism | Reuse the existing **per-org warehouse store** (`ensureOrgWarehouse`) | The warehouse already exists for no-stores orgs; extend it to all orgs |
| Costing method | **Moving weighted average**, **org-level** | Client's choice; simpler than FIFO, accurate enough |
| Cost storage | Single `averageCost` on `Product`, recomputed on each purchase | One number per product per org |
| Product identity | `name + model` stays **unique per org** | Cost varies over time; products must NOT duplicate |
| Selling price | **One current price** per product (Option A); admin updates it, latest applies to all units | Customers see one shelf price; raising price lifts margin on old stock too |
| Selling price control | **Manual** — never auto-derived from cost | Pricing is a business decision |
| Purchase history | Every purchase stored as its own row, kept forever | Required to compute the average anyway — comes free |
| COGS source on sale | Switch from `product.purchasePrice` → `product.averageCost` | Makes profit reflect real cost |
| Margin prompt | Optional, non-blocking "cost rose, review price?" at purchase | Nice-to-have; connects rising cost to price review |

---

## 3. How It Behaves (Worked Example — Option A)

| Step | Event | Stock | Average cost | Selling price | Profit/unit on sale |
|------|-------|-------|--------------|---------------|---------------------|
| 1 | Purchase 10 @ 110, set price 150 | 10 | 110 | 150 | — |
| 2 | Sell 4 @ 150 | 6 | 110 | 150 | 150 − 110 = **40** |
| 3 | Purchase 10 @ 120, set price 160 | 16 | (6×110 + 10×120) ÷ 16 = **116.25** | 160 | — |
| 4 | Sell 5 @ 160 | 11 | 116.25 | 160 | 160 − 116.25 = **43.75** |

**Key rules:**
- After step 3, **all** units (including the 6 bought at 110) sell at 160. There is only ever one current selling price.
- Average cost only recomputes **on purchase**. Sales and distribution do not change it.
- Past sales keep the cost and price snapshotted at their sale time — history stays accurate.

### Weighted-average formula (on each purchase)

```
onHand      = total units of this product across the org (warehouse + all stores)
oldValue    = onHand × currentAverageCost
newValue    = oldValue + (purchaseQty × purchaseUnitCost)
newOnHand   = onHand + purchaseQty
newAverage  = newOnHand > 0 ? (newValue / newOnHand) : purchaseUnitCost
```
Rounded to 2 decimals (money). If `onHand` is 0, the new average is simply the purchase unit cost.

---

## 4. Current State (Grounded in Code)

- **`Product`** (`api/prisma/models/product.prisma`): has `purchasePrice` and `sellingPrice` as single `Decimal(10,2)` fields, plus `name`, `model`, `normalizedName`, `normalizedModel`, unique `name+model` per org.
- **Sale COGS** (`sales.service.ts:149`): `unitPurchasePrice = Number(product.purchasePrice)` — snapshots the single product cost. **This is the line that changes.**
- **`StockSupply`** (`inventory.prisma`): always targets a `storeId`; carries a `unitPurchasePrice` that is currently only used in a "stock investment" report, NOT in sale COGS.
- **No central pool, no Purchase entity, no average cost** exist today.
- **Warehouse store**: `stores.service.ts` has `ensureOrgWarehouse(organizationId)` — a hidden store used as org-level inventory for `hasStores = false` orgs. `organizations.service.ts` calls it on org create/flip. **This is the pool we will reuse.**
- **Tenant scoping**: `$extends` extension auto-injects `organizationId` on reads/writes/creates and rewrites `findUnique → findFirst`. New models added to `TENANT_MODELS` get scoped automatically. Raw SQL is NOT covered (manual filtering required).

---

## 5. Target Model

### 5.1 New `Purchase` model

New file: `api/prisma/models/purchase.prisma`

```prisma
model Purchase {
  id                String       @id @default(cuid())
  productId         String
  product           Product      @relation(fields: [productId], references: [id])
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  quantity          Int
  unitPurchasePrice Decimal      @db.Decimal(10, 2)
  totalCost         Decimal      @db.Decimal(10, 2)   // quantity × unitPurchasePrice (stored for history/reports)
  invoiceNumber     String?                            // optional supplier invoice number/reference (free text)
  purchaseDate      DateTime     @db.Date
  note              String?
  purchasedById     String
  purchasedBy       User         @relation("PurchasesCreatedBy", fields: [purchasedById], references: [id])
  createdAt         DateTime     @default(now())

  @@index([productId])
  @@index([organizationId])
  @@index([purchaseDate])
  @@map("purchase")
}
```

> Add `purchases Purchase[]` relations to `Organization`, `Product`, and `User` (`@relation("PurchasesCreatedBy")`).
> Add `Purchase` to `TENANT_MODELS` in `tenant-scoping.extension.ts`.

### 5.2 `Product` — add `averageCost`

```prisma
model Product {
  // ... existing fields ...
  averageCost Decimal @default(0) @db.Decimal(10, 2)   // org-level moving weighted average; source of truth for COGS
}
```

**Decision on the legacy `purchasePrice` field:** keep it for now as the **initial/seed cost** (used to seed `averageCost` at product creation and during migration). COGS no longer reads it. We can deprecate/remove it in a later cleanup once `averageCost` is proven. (Flagged in §9.)

### 5.3 Central pool = warehouse store for ALL orgs

- Extend `ensureOrgWarehouse` usage so **every org** (not just `hasStores = false`) has a warehouse store that acts as the central pool.
- **Purchases** increase warehouse inventory.
- **Has-stores orgs:** distribution (the reworked "stock supply") moves units **warehouse → real store**. Sales draw from the real store.
- **No-stores orgs:** the warehouse IS their inventory. Sales draw from the warehouse directly (already the case today). No distribution step.

### 5.4 New `AuditAction` values

```prisma
enum AuditAction {
  // ... existing ...
  PURCHASE_CREATED
  PRODUCT_COST_RECALCULATED   // optional: log average-cost changes
}
```

---

## 6. Flows

### 6.1 Purchase (new) — both org types

`POST /api/purchases` (admin only)

1. Validate product exists (org-scoped).
2. Resolve the org's warehouse store (`ensureOrgWarehouse`).
3. In a transaction (with inventory lock on `warehouse + product`):
   - Compute `onHand` (total org units for product — warehouse + all stores) and current `averageCost`.
   - Compute `newAverage` (formula in §3).
   - Create `Purchase` row (`quantity`, `unitPurchasePrice`, `totalCost`, `purchaseDate`, `invoiceNumber?`, `note?`).
   - Increase **warehouse** inventory by `quantity`.
   - Update `product.averageCost = newAverage`.
   - **Optionally** update `product.sellingPrice` if the admin supplied a new one in the request (Option A).
   - Write `PURCHASE_CREATED` audit log.
4. Return the purchase + updated product cost/price.

### 6.2 Distribution (rework existing stock supply) — has-stores orgs only

The existing "stock supply" becomes "**distribute from warehouse to store**":

- Moves units: **decrement warehouse inventory, increment target store inventory**.
- **No `unitPurchasePrice` captured here anymore** — cost was set at purchase time. (Keep the column for historical rows; stop writing it, or write the current `averageCost` for reference.)
- Insufficient warehouse stock → reject.
- Existing supply-correction flows adapt to warehouse↔store movements.

> Decision to confirm (§9): do we relabel the existing `/supply` feature as "Distribute", or keep the name? Recommendation: relabel UI to "Distribute to store"; keep `StockSupply` table name to avoid a large rename.

### 6.3 Sale (one-line cost change) — unchanged for the manager

- Manager flow, screens, and selling price behavior **unchanged**.
- The ONLY change: COGS snapshot source.
  - **Before:** `unitPurchasePrice = Number(product.purchasePrice)`
  - **After:** `unitPurchasePrice = Number(product.averageCost)`
- Average cost is **never shown** to branch managers.

### 6.4 Purchase history (free)

`GET /api/products/:id/purchases` (admin only) — paginated list of `Purchase` rows for the product: date, quantity, unit cost, total, invoice number, who recorded it. Also a per-org `GET /api/purchases` list with filters (date range, product, invoice number).

---

## 7. Backend Changes — File by File

### 7.1 Schema / Prisma
- [ ] New `api/prisma/models/purchase.prisma` (§5.1)
- [ ] `product.prisma` — add `averageCost`
- [ ] `organization.prisma`, `auth.prisma` (User) — add `purchases` relations
- [ ] `audit.prisma` — add `PURCHASE_CREATED` (+ optional `PRODUCT_COST_RECALCULATED`)
- [ ] `tenant-scoping.extension.ts` — add `"Purchase"` to `TENANT_MODELS`
- [ ] Migration: create `purchase` table, add `product.averageCost`, add enum values
- [ ] Backfill migration (§8)

### 7.2 New `purchases` module
- [ ] `api/src/modules/purchases/` — module, controller, service
- [ ] `dto/create-purchase.dto.ts` — `productId`, `quantity`, `unitPurchasePrice`, `purchaseDate`, optional `invoiceNumber`, `note`, optional `newSellingPrice`
- [ ] `dto/purchase-query.dto.ts` — pagination + filters
- [ ] `purchases.service.ts` — `create()` (the weighted-average transaction, §6.1), `findAll()`, `findByProduct()`
- [ ] Register in `AppModule`
- [ ] All routes `@Roles(admin)` (admins purchase; not branch managers)

### 7.3 `sales.service.ts`
- [ ] Change COGS source: `unitPurchasePrice = Number(product.averageCost)` (line ~149)
- [ ] Sale **correction** path: confirm it reuses the snapshotted cost on the existing sale (do NOT re-pull current average) — corrections should not retroactively change historical cost
- [ ] Verify `unitPurchasePrice` is never exposed to branch-manager-facing responses

### 7.4 `stores.service.ts`
- [ ] Ensure **every** org has a warehouse (extend `ensureOrgWarehouse` invocation to has-stores orgs too — on org create, and a backfill for existing orgs)
- [ ] Confirm the warehouse store is excluded from normal store lists / store pickers in has-stores orgs (it's the pool, not a sales location)

### 7.5 `stock-supplies` module (distribution rework)
- [ ] Reframe `recordStockChange` to move **warehouse → store** (decrement warehouse, increment store) for has-stores orgs
- [ ] Stop requiring/writing `unitPurchasePrice` on distribution (cost is set at purchase); decide whether to keep writing `averageCost` for reference
- [ ] Reject distribution when warehouse stock is insufficient
- [ ] Adapt correction-add / correction-subtract to warehouse↔store semantics
- [ ] No-stores orgs: distribution is not applicable (block or hide)

### 7.6 `reports.service.ts`
- [ ] **Stock investment** should now come from `Purchase` (sum `totalCost`), not `StockSupply`. Update `fetchStockInvestment` (raw SQL → `purchase` table, add `AND "organizationId" = ?`)
- [ ] Confirm COGS-based reports now reflect `averageCost` via the sale snapshot (no report change needed if they read the sale's `unitPurchasePrice`)
- [ ] Any report that summed `stock_supply.unitPurchasePrice` as "cost of goods purchased" must switch to `purchase`
- [ ] **New raw SQL** added for purchases reporting must include `organizationId` (tenant rule)

### 7.7 `products.service.ts`
- [ ] On product **create**: seed `averageCost` from the initial `purchasePrice` (or 0 if we drop that field — see §9)
- [ ] Expose `averageCost` only in admin responses, never to managers
- [ ] `GET /api/products/:id/purchases` endpoint (delegates to purchases service)

---

## 8. Data Migration / Backfill

Non-destructive:

1. Add `purchase` table and `product.averageCost` (default 0).
2. **Seed `averageCost`** for existing products: set `averageCost = purchasePrice` (best available cost today).
3. **Backfill warehouse stores** for existing has-stores orgs (`ensureOrgWarehouse` for each).
4. **Optional — reconstruct purchase history** from existing `StockSupply` rows of type `supply` that carry a `unitPurchasePrice`: create matching `Purchase` rows so history isn't empty on day one. (Decision in §9 — may not be worth it; supply ≠ purchase semantically.)
5. Existing inventory stays in stores as-is; no rebalancing needed (average seeded from `purchasePrice`).

---

## 9. Phase 0 Decisions — RESOLVED ✅

All confirmed with client on 2026-06-20:

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Legacy `purchasePrice` field | **KEEP** — used as the initial/seed cost at product creation; COGS reads `averageCost` thereafter |
| 2 | Distribution rename | **RENAME** the `/supply` UI label to **"Distribute to Store"**; keep the `StockSupply` table name |
| 3 | Old history | **START FRESH** — purchase history begins at launch; old stock-supply rows are NOT converted |
| 4 | Invoice | **Invoice number only** — a free-text `invoiceNumber` field on the purchase (no file upload, no separate supplier field) |
| 5 | Margin prompt | **DEFERRED** to a later round — tracked in §13 Deferred Follow-ups so it is not forgotten |
| 6 | Warehouse visibility | **KEEP HIDDEN** — warehouse store must not appear in store pickers, store lists, or per-store dashboards in has-stores orgs |

---

## 10. Frontend Changes

### 10.1 New: Purchases UI (admin)
- [ ] **Purchase entry form**: product picker, quantity, unit purchase price, purchase date, optional invoice number/note, and an **optional "update selling price" field** (Option A). Show live preview: "New average cost will be X; at selling price Y that's Z% margin."
- [ ] **Purchases list** page: filter by product, date range, invoice number; show qty, unit cost, total.
- [ ] **Purchase history on the product detail**: a tab/section listing all purchases for that product (the §3 table).

> The "cost rose, review your price?" margin prompt is **deferred** — see §13 Deferred Follow-ups.

### 10.2 Distribution UI (rework existing supply screen — has-stores orgs)
- [ ] Relabel "Stock Supply" → "Distribute to Store" (pending §9 decision).
- [ ] Remove the purchase-price input from this screen (cost now lives on purchases).
- [ ] Show available warehouse stock when distributing.

### 10.3 No changes
- [ ] **Sales / Submit Sale**: no UI change — manager still sells at selling price; average cost stays hidden.
- [ ] **Product selling price**: still editable on the product as today (in addition to the optional update-at-purchase shortcut).

### 10.4 Types & API hooks
- [ ] Add `Purchase` types, `averageCost` on product (admin-only views).
- [ ] TanStack Query hooks for `/api/purchases` and `/api/products/:id/purchases`.

---

## 11. Phased Checklist

### Phase 0 — Confirm open decisions (§9)
- [x] All six decisions in §9 answered (resolved 2026-06-20).

### Phase 1 — Schema & migration
- [ ] `purchase.prisma`, `product.averageCost`, relations, enum values, `TENANT_MODELS` update
- [ ] Migration + backfill (seed averageCost, backfill warehouses)
- [ ] `npx prisma generate`

### Phase 2 — Purchasing backend
- [ ] `purchases` module (create with weighted-average transaction, list, by-product)
- [ ] Warehouse-for-all-orgs handling in `stores.service.ts`
- [ ] Audit logging

### Phase 3 — Cost switch on sales
- [ ] Sale COGS reads `averageCost`
- [ ] Correction path keeps historical snapshot
- [ ] Manager responses never expose cost

### Phase 4 — Distribution rework
- [ ] Stock supply → warehouse-to-store movement
- [ ] Insufficient-warehouse checks, correction semantics
- [ ] No-stores orgs: distribution hidden/blocked

### Phase 5 — Reports
- [ ] Stock investment from `purchase` (org-scoped raw SQL)
- [ ] Verify profit/COGS reports reflect average cost

### Phase 6 — Frontend
- [ ] Purchase form (+ live average/margin preview, optional price update)
- [ ] Purchases list + per-product history
- [ ] Distribution screen rework
- [ ] Types + query hooks

> Margin prompt is NOT in this phase — deferred (§13).

### Phase 7 — Testing
- [ ] Weighted-average math across multiple purchases (matches §3 table exactly)
- [ ] Average unchanged by sales and by distribution; changes only on purchase
- [ ] No-stores org: purchase → sell directly from warehouse; correct COGS
- [ ] Has-stores org: purchase → warehouse → distribute → store → sell; correct COGS
- [ ] Selling price update at purchase applies to all units; past sales keep old price
- [ ] Cross-tenant: purchases/averageCost never leak across orgs (extension + raw SQL)
- [ ] Branch manager cannot see average cost anywhere
- [ ] Migration: existing products get seeded averageCost; existing orgs get warehouses

---

## 12. Things to Be Careful About

1. **Average changes ONLY on purchase.** Do not recompute on sale or distribution — that would corrupt the running average. Sales subtract units at the current average (value follows), distribution just moves units between locations (no value change).

2. **Sale corrections must NOT re-pull the current average.** A correction edits a historical sale; it must keep that sale's original `unitPurchasePrice` snapshot, or historical profit silently shifts.

3. **`onHand` for the blend = warehouse + all stores**, not warehouse alone. If you blend over central stock only, distributing units out then buying more skews the average.

4. **Warehouse store must be hidden** from store pickers, store lists, and per-store dashboards in has-stores orgs — it's the pool, not a sales location. A leaked warehouse "store" will confuse users and reports.

5. **Raw SQL in reports is not tenant-scoped automatically.** Any new purchase reporting query must manually include `AND "organizationId" = ?` (same rule as `MULTITENANT_DESIGN.md` §9).

6. **Concurrency:** purchases and distributions both mutate warehouse inventory and `averageCost`. Reuse `lockInventoryForMutation` (now org-aware) on the warehouse+product row, and update `averageCost` inside the same transaction to avoid races between two simultaneous purchases.

7. **Decimal rounding:** keep `averageCost` at 2 decimals consistently; rounding each step vs. carrying precision can drift over many purchases. Decide once (recommend: round to 2 dp after each purchase, matching money handling elsewhere).

8. **No-stores vs has-stores split** must be explicit in every new flow — purchasing is shared, distribution is has-stores-only, warehouse-as-sellable is no-stores-only.

9. **Legacy `StockSupply.unitPurchasePrice`** stops being the cost source. Make sure no report still treats it as COGS once purchases exist.

---

## 13. Deferred Follow-ups (DO NOT FORGET — build after the core feature ships)

These are intentionally **out of scope for the initial build** but agreed to be done later. Keep this list alive.

### 13.1 Margin prompt at purchase time
When the admin records a purchase whose unit cost is **higher than the current average cost**, show a **non-blocking** note:

> *"New average cost is 116.25. Current selling price is 150 → margin 22.5%. Update the selling price?"*

- Purely a reminder with the margin math pre-computed; the admin still decides.
- Non-blocking — the purchase saves regardless.
- Includes a shortcut to update the product's selling price (the same Option A update path).
- **Why deferred:** nice-to-have polish; core purchasing + weighted-average cost is the priority.

### 13.2 Possible future cleanups (not committed)
- Remove the legacy `Product.purchasePrice` field once `averageCost` is proven in production (decision #1 kept it as a seed for now).
