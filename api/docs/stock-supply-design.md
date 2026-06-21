# Stock Supply (Distribution) — Design Reference

This document explains how stock supply works **after the purchasing/weighted-average-cost change**. Stock supply is now **distribution** — moving already-purchased stock from the organization's central warehouse out to a store. Cost is captured earlier, at **purchase** time. Use this when implementing features, reviewing reports, or onboarding.

_Last updated: 2026-06-21_

> **Cost model changed.** Product cost is now the **moving weighted-average cost** (`Product.averageCost`), set by **purchases** (`/api/purchases`). Stock supply no longer captures cost. See [`PURCHASING_DESIGN.md`](../../PURCHASING_DESIGN.md) for the full purchasing/costing design.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Where stock comes from: Purchase → Warehouse → Store](#2-where-stock-comes-from-purchase--warehouse--store)
3. [Schema](#3-schema)
4. [Pricing: Purchase vs Product vs Supply vs Sale](#4-pricing-purchase-vs-product-vs-supply-vs-sale)
5. [Immutable Supplies & Corrections](#5-immutable-supplies--corrections)
6. [API Endpoints](#6-api-endpoints)
7. [Business Rules](#7-business-rules)
8. [Form & UX](#8-form--ux)
9. [Transaction Flow](#9-transaction-flow)
10. [Reports That Depend on This](#10-reports-that-depend-on-this)

---

## 1. Overview

**Stock supply** moves inventory from the organization's central **warehouse** to a **store**. Each event is stored as an immutable row in `stock_supply`. Store and warehouse live quantities both live in `inventory` (each is an `inventory` row scoped to a `storeId`; the warehouse is a hidden store).

This module is **admin-only**. Branch managers read inventory but do not create supplies.

Design goals:

- **Strong audit trail** — append-only distribution history, no silent edits
- **Single source of cost** — cost is set once, at purchase time (`Product.averageCost`); distribution does not change cost
- **Good UX** — users never type negative numbers; corrections use dedicated endpoints

> **Multi-tenant note.** In organizations with `hasStores = false` there are no stores to distribute to — stock supply does not apply. Those orgs sell directly from the warehouse. See [`PURCHASING_DESIGN.md`](../../PURCHASING_DESIGN.md).

---

## 2. Where stock comes from: Purchase → Warehouse → Store

```
Vendor ──purchase──▶ Warehouse (central pool) ──supply/distribute──▶ Store ──sale──▶ Customer
        (sets cost)                              (moves units)              (snapshots cost)
```

| Step | Endpoint | What happens | Cost effect |
|------|----------|--------------|-------------|
| **Purchase** | `POST /api/purchases` | Buy units from a vendor; they land in the **warehouse** | Recomputes `Product.averageCost` (moving weighted average) |
| **Supply / distribute** | `POST /api/stock-supplies` | Move units **warehouse → store** | **None** — cost already set at purchase |
| **Sale** | `POST /api/sales` | Store sells to a customer | Snapshots `Product.averageCost` onto the sale as COGS |

The warehouse is the only place purchases land. Distribution never creates new cost; it just relocates units the org already owns.

---

## 3. Schema

We use the existing `StockSupply` model in `prisma/models/inventory.prisma`.

### Core fields

| Column | Purpose |
|--------|---------|
| `productId` | Product being distributed |
| `storeId` | Destination store (must **not** be the warehouse) |
| `quantity` | Units moved (signed internally for correction subtract) |
| `unitPurchasePrice` | **Reference snapshot** of `Product.averageCost` at distribution time. Informational only — **not** a cost source for profit (see [§4](#4-pricing-purchase-vs-product-vs-supply-vs-sale)) |
| `suppliedById` | Admin who performed the action |
| `note` | Optional for normal supply; **required** for corrections |
| `type` | `supply` \| `correction_add` \| `correction_subtract` |
| `correctsSupplyId` | Optional FK to the `StockSupply` row being corrected |
| `organizationId` | Tenant scope |
| `createdAt` | Immutable timestamp |

**Quantity sign convention:**

| `type` | API input | Stored `quantity` |
|--------|-----------|-------------------|
| `supply` | positive | positive |
| `correction_add` | positive | positive |
| `correction_subtract` | positive | **negative** (negated by the API) |

Users always enter a **positive** number in forms. The subtract endpoint converts it internally.

---

## 4. Pricing: Purchase vs Product vs Supply vs Sale

Four price/cost concepts now exist. They must not be confused.

| Location | Fields | Role |
|----------|--------|------|
| **Purchase** | `unitPurchasePrice`, `totalCost` | **The real cost event.** What the org actually paid a vendor for a batch. Drives `Product.averageCost`. Never changes after the row is created. |
| **Product** | `averageCost`, `sellingPrice` | `averageCost` = **moving weighted-average cost** (source of truth for COGS). `sellingPrice` = current catalog price. Both update over time. (`purchasePrice` is a legacy column, retained but **unused**.) |
| **StockSupply** | `unitPurchasePrice` | **Reference snapshot** of `averageCost` when stock was distributed. Informational; not used for profit. |
| **Sale** | `unitPurchasePrice`, `unitPrice` | **Snapshots at sale time** — `unitPurchasePrice` = `Product.averageCost`, `unitPrice` = `Product.sellingPrice`. Frozen for profit on that specific sale. |

### Why cost lives on the purchase / average cost — not on supply

Stock can be bought at different prices over time. The system blends those into a **moving weighted average** on the product, recomputed on each purchase:

**Example:**

1. January — buy 10 units @ **110** → `averageCost = 110`
2. February — buy 10 units @ **120** → `averageCost = (10×110 + 10×120) / 20 = 115`

Sales from then on are costed at the current `averageCost` (115) until the next purchase shifts it. Distribution between warehouse and stores does **not** change the average — it only moves units.

### Price snapshot on sale (unchanged principle)

> Both the selling price and the cost at the time of sale are stored permanently on the sale (`unitPrice`, `unitPurchasePrice`). Changing the product's price or average cost later does not alter any historical sale or profit record.

---

## 5. Immutable Supplies & Corrections

### Why supplies are not editable

Supply (distribution) records are **append-only**:

- Full audit trail — who moved what, when, to which store
- Distribution history reports stay trustworthy
- Aligns with sale corrections (new records, not silent edits)

If an admin makes a mistake (wrong quantity, product, or store), they do **not** edit or delete the original row. They post a **corrective supply**.

### Corrective supply flow

1. Admin finds the incorrect supply record.
2. Admin uses a **correction endpoint** (not a negative number in the normal supply form).
3. A new `stock_supply` row is created with:
   - `type`: `correction_add` or `correction_subtract`
   - Mandatory `note` (e.g. _"Corrects supply #42 — meant 10 not 100"_)
   - Optional `correctsSupplyId` linking to the original
4. Both warehouse and store `inventory.quantity` are adjusted in the same transaction (a correction moves units back from the store to the warehouse, or out again).
5. An audit log entry is written (`STOCK_SUPPLIED`).

**Example — overstated distribution:**

| Step | Action | `quantity` | Store effect | Warehouse effect |
|------|--------|------------|--------------|------------------|
| 1 | Original supply (mistake) | +100 | +100 | −100 |
| 2 | Correction subtract | −90 | −90 | +90 |
| **Net** | | +10 | +10 | −10 |

---

## 6. API Endpoints

All routes are **admin-only**, under `/api/stock-supplies`.

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/stock-supplies` | Distribute warehouse → store — quantity **> 0**, note optional |
| `GET` | `/stock-supplies` | Paginated history — filters: store, product, type, date, etc. |
| `POST` | `/stock-supplies/corrections/add` | Fix under-distribution — quantity **> 0**, note **required** |
| `POST` | `/stock-supplies/corrections/subtract` | Fix over-distribution — quantity **> 0**, note **required**; stored as negative |

The destination store must exist, be active, and **not** be the organization warehouse. There must be enough **warehouse** stock to cover a distribution.

---

## 7. Business Rules

1. **Normal supply** — positive quantity only; `type = supply`; moves units warehouse → store.
2. **Warehouse must have stock** — a distribution is rejected if warehouse quantity < requested quantity.
3. **Cannot distribute to the warehouse** — the destination store may not be the warehouse itself.
4. **Corrections** — admin only; note mandatory; flagged via `type`.
5. **Inventory never below zero** — neither warehouse nor store quantity may go negative (enforced in app logic; DB may also use `CHECK (quantity >= 0)`).
6. **Cost is not set here** — distribution records a reference `unitPurchasePrice` (= current `averageCost`) but never changes `Product.averageCost`.
7. **Atomic updates** — create `StockSupply` + adjust both `inventory` rows in one transaction.
8. **Audit** — write `STOCK_SUPPLIED` (and optionally `INVENTORY_UPDATED`) after success.
9. **Immutability** — no `PATCH` or `DELETE` on supply rows.

---

## 8. Form & UX

### Normal supply (distribute) form

- Select store, product, quantity
- Show available **warehouse** stock for the product
- **No purchase-price input** — cost is set at purchase time, not here
- Note: optional

### Correction forms (separate UI)

- **Add stock** — correction add endpoint; reason/note always visible and required
- **Remove stock** — correction subtract endpoint; reason/note always visible and required
- Never expose a single "quantity" field where users type `-90`

This keeps routine distribution simple and makes mistakes/fixes explicit.

---

## 9. Transaction Flow

```
POST /stock-supplies (or correction endpoint)
        │
        ├─ Resolve destination store (must be active, not the warehouse)
        ├─ Resolve org warehouse (ensureOrgWarehouse)
        ├─ Validate product (ProductsService.findOne)
        │
        └─ prisma.$transaction
              ├─ Lock warehouse inventory row + store inventory row
              ├─ Check warehouse has enough stock (for distribution)
              ├─ INSERT stock_supply (reference unitPurchasePrice = averageCost)
              ├─ UPDATE warehouse inventory (decrement)
              └─ UPDATE/UPSERT store inventory (increment)
        │
        └─ INSERT audit_log
```

---

## 10. Reports That Depend on This

| Report / metric | Formula | Source |
|-----------------|---------|--------|
| Stock investment (period) | `SUM(totalCost)` on `purchase` | What was actually paid to vendors in the period |
| Current stock value (live) | `SUM(inventory.quantity × Product.averageCost)` | Live on-hand × weighted-average cost |
| COGS (period) | `SUM(quantitySold × unitPurchasePrice)` on `sale` | Sale-time snapshot of `averageCost` |
| Gross profit | Revenue − COGS | Sale snapshots |
| Supply / distribution history | List `stock_supply` with `type` | Corrections labeled separately |

> Stock investment now comes from the **`purchase`** table, not `stock_supply`. Supply rows no longer represent money spent — they represent internal movement of already-owned stock.

---

## Related docs

- [Purchasing & weighted-average cost](../../PURCHASING_DESIGN.md) — the purchasing/costing model (authoritative)
- [Modules Implementation Guide](./modules-implementation-guide.md) — build order, conventions, audit logging
- [System design](../../system-design.md) — full domain rules and report specs
