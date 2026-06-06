# Stock Supply — Design Reference

This document explains why stock supply works the way it does: pricing snapshots, immutable records, correction endpoints, and schema choices. Use it when implementing features, reviewing reports, or onboarding.

_Last updated: 2026-06-06_

---

## Table of Contents

1. [Overview](#1-overview)
2. [Schema](#2-schema)
3. [Pricing: Product vs Supply vs Sale](#3-pricing-product-vs-supply-vs-sale)
4. [Why No `unitSellingPrice` on Supply](#4-why-no-unitsellingprice-on-supply)
5. [Immutable Supplies & Corrections](#5-immutable-supplies--corrections)
6. [API Endpoints](#6-api-endpoints)
7. [Business Rules](#7-business-rules)
8. [Form & UX](#8-form--ux)
9. [Transaction Flow](#9-transaction-flow)
10. [Reports That Depend on This](#10-reports-that-depend-on-this)

---

## 1. Overview

**Stock supply** is when an admin sends inventory to a store. Each event is stored as an immutable row in `stock_supply`. The store's live quantity lives in `inventory`.

This module is **admin-only**. Branch managers read inventory but do not create supplies.

Design goals:

- **Strong audit trail** — append-only supply history, no silent edits
- **Accurate financial history** — cost frozen at supply time, not tied to today's catalog price
- **Good UX** — users never type negative numbers; corrections use dedicated endpoints

---

## 2. Schema

We use the existing `StockSupply` model in `prisma/models/inventory.prisma`, extended with optional fields for corrections.

### Core fields (existing)

| Column | Purpose |
|--------|---------|
| `productId` | Product being supplied |
| `storeId` | Destination store |
| `quantity` | Units added or removed (signed internally for correction subtract) |
| `unitPurchasePrice` | **Cost snapshot at supply time** (see [§3](#3-pricing-product-vs-supply-vs-sale)) |
| `suppliedById` | Admin who performed the action |
| `note` | Optional for normal supply; **required** for corrections |
| `createdAt` | Immutable timestamp |

### Optional fields (corrections & reporting)

| Column | Purpose |
|--------|---------|
| `type` | `supply` \| `correction_add` \| `correction_subtract` — clear intent in history and reports |
| `correctsSupplyId` | Optional FK to the mistaken `StockSupply` row being corrected |

```prisma
enum StockSupplyType {
  supply
  correction_add
  correction_subtract
}
```

**Quantity sign convention:**

| `type` | API input | Stored `quantity` |
|--------|-----------|-------------------|
| `supply` | positive | positive |
| `correction_add` | positive | positive |
| `correction_subtract` | positive | **negative** (negated by the API) |

Users always enter a **positive** number in forms. The subtract endpoint converts it internally.

---

## 3. Pricing: Product vs Supply vs Sale

Three different price concepts exist in the system. They must not be confused.

| Location | Fields | Role |
|----------|--------|------|
| **Product** | `purchasePrice`, `sellingPrice` | **Current catalog prices** — what the product costs and sells for *today*. Admin can update these anytime. |
| **StockSupply** | `unitPurchasePrice` | **Cost snapshot at supply time** — what this shipment actually cost when stock was sent to a store. Never changes after the row is created. |
| **Sale** | `unitPurchasePrice`, `unitPrice` | **Snapshots at sale time** — frozen cost and selling price for profit on that specific sale. Never changes after the row is created. |

### Why not read only from `Product.purchasePrice`?

Catalog prices change. Financial history must not.

**Example:**

1. January — Admin supplies 50 iPhones at **$800** each. `Product.purchasePrice` is $800.
2. March — Supplier raises price. Admin updates `Product.purchasePrice` to **$850** and supplies 30 more.

If supply history used today's product price:

- January stock investment would incorrectly show **$850 × 50**
- Reports would drift whenever someone edits the product

Storing `unitPurchasePrice` on each supply row keeps **stock investment** reports accurate.

### Real-world parallel

Retail and inventory systems (Shopify, Square, Odoo, etc.) typically:

- Keep a **current cost** on the product/SKU
- Store **cost at receipt** on purchase/supply lines
- Store **price at sale** on order/sale lines

This app follows the same pattern at a simpler scale.

### System design rule (from `system-design.md`)

> **Price snapshot on sale.** Both the selling price and purchase price at the time of sale are stored permanently in `sales.unit_purchase_price` and `sales.unit_price`. Changing product prices later does not alter any historical sale or profit record.

The same principle applies to supplies: **snapshot at event time**.

---

## 4. Why No `unitSellingPrice` on Supply

**Supply = stock into a store (cost / investment side).**  
**Sale = stock out to a customer (revenue side).**

| Event | Money direction | Price field |
|-------|-----------------|-------------|
| Supply | Admin → store (inventory) | `unitPurchasePrice` only |
| Sale | Store → customer | `unitPrice` (selling) + `unitPurchasePrice` (COGS snapshot) |

`unitSellingPrice` on supply would only matter if branches **buy** from headquarters at an internal wholesale price. This system models: admin supplies at **purchase cost**, managers sell at **selling price** to end customers.

Selling price belongs on **Sale**, defaulting from `Product.sellingPrice` at sale time and snapshotted there.

---

## 5. Immutable Supplies & Corrections

### Why supplies are not editable

Supply records are **append-only**:

- Full audit trail — who supplied what, when
- Supply history reports stay trustworthy
- Aligns with sale corrections (new records, not silent edits)

If an admin makes a mistake (wrong quantity, product, or store), they do **not** edit or delete the original row. They post a **corrective supply**.

### Corrective supply flow

1. Admin finds the incorrect supply record.
2. Admin uses a **correction endpoint** (not a negative number in the normal supply form).
3. A new `stock_supply` row is created with:
   - `type`: `correction_add` or `correction_subtract`
   - Mandatory `note` (e.g. _"Corrects supply #42 — meant 10 not 100"_)
   - Optional `correctsSupplyId` linking to the original
4. `inventory.quantity` is updated in the same transaction.
5. An audit log entry is written (`STOCK_SUPPLIED`).

**Example — overstated quantity:**

| Step | Action | `quantity` | Inventory effect |
|------|--------|------------|------------------|
| 1 | Original supply (mistake) | +100 | +100 |
| 2 | Correction subtract | −90 | −90 |
| **Net** | | +10 | +10 |

### Why not allow editing supplies?

Editing is simpler UX but weakens audit unless you build full edit history (old/new values on every change). Append-only + visible corrections is safer for a multi-store system with financial reports. See team discussion: editable supplies trade convenience for weaker historical truth.

---

## 6. API Endpoints

All routes are **admin-only**, under `/api/stock-supplies`.

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/stock-supplies` | Normal supply — quantity **> 0**, note optional |
| `GET` | `/stock-supplies` | Paginated history — filters: store, product, type, date, etc. |
| `POST` | `/stock-supplies/corrections/add` | Fix under-count — quantity **> 0**, note **required** |
| `POST` | `/stock-supplies/corrections/subtract` | Fix over-count — quantity **> 0**, note **required**; stored as negative |

Validation reuses `StoresService` and `ProductsService` (active store/product must exist), same pattern as the Inventory module.

---

## 7. Business Rules

1. **Normal supply** — positive quantity only; `type = supply`.
2. **Corrections** — admin only; note mandatory; flagged via `type`.
3. **Inventory never below zero** — subtract/correction rejected if `inventory.quantity + delta < 0`. Same rule as sales (enforced in app logic; DB may also use `CHECK (quantity >= 0)` on `inventory`).
4. **Atomic updates** — create `StockSupply` + upsert/update `inventory` in one transaction.
5. **Audit** — write `STOCK_SUPPLIED` (and optionally `INVENTORY_UPDATED`) after success.
6. **Immutability** — no `PATCH` or `DELETE` on supply rows.

---

## 8. Form & UX

### Normal supply form

- Select store, product, quantity
- **`unitPurchasePrice`**: pre-filled from `Product.purchasePrice`, **admin may override** if this batch cost differs (supplier discount, freight, etc.)
- Note: optional

### Correction forms (separate UI)

- **Add stock** — correction add endpoint; reason/note always visible and required
- **Remove stock** — correction subtract endpoint; reason/note always visible and required
- Never expose a single "quantity" field where users type `-90`

This keeps routine restocking simple and makes mistakes/fixes explicit.

---

## 9. Transaction Flow

```
POST /stock-supplies (or correction endpoint)
        │
        ├─ Validate store (StoresService.findOne)
        ├─ Validate product (ProductsService.findOne)
        ├─ Resolve unitPurchasePrice (DTO or product default)
        ├─ If subtract: ensure inventory.quantity - qty >= 0
        │
        └─ prisma.$transaction
              ├─ INSERT stock_supply
              └─ UPSERT inventory (increment quantity; create row if missing)
        │
        └─ INSERT audit_log
```

---

## 10. Reports That Depend on This

| Report / metric | Formula | Uses |
|-----------------|---------|------|
| Stock investment (period) | `SUM(quantity × unitPurchasePrice)` on `stock_supply` | Per-row snapshot, not `Product.purchasePrice` |
| Current stock value (live) | `SUM(inventory.quantity × Product.purchasePrice)` | Live catalog cost × on-hand qty |
| COGS (period) | `SUM(quantitySold × unitPurchasePrice)` on `sale` | Sale-time snapshot |
| Gross profit | Revenue − COGS | Sale snapshots |
| Supply history | List `stock_supply` with `type` | Corrections labeled separately |

---

## Related docs

- [Modules Implementation Guide](./modules-implementation-guide.md) — build order, conventions, audit logging
- [System design](../../system-design.md) — full domain rules and report specs
