# Customers, Multi-Item Sales, Invoices & Payments — Design Document

> **Status:** Design complete — implementation not started.
> **Last updated:** 2026-06-22
> **Purpose:** Single source of truth for four related features: **customers**, **multi-item sales**, **persisted numbered invoices**, and **payments + outstanding balance**. Reference phase by phase. Companion to `PURCHASING_DESIGN.md` and `PURCHASE_CORRECTION_DESIGN.md`.

---

## 1. Overview & Goals

The client (organizations **without branches** — `hasStores = false`) needs to sell to **named customers on credit**, hand them a **printable invoice**, and track **who owes what**. In detail:

- **Customers** — a real customer entity (doesn't exist today; sales are anonymous).
- **Multi-item sales** — one sale can contain several products (today a sale is one product).
- **Invoices** — persisted, numbered, printable; customer at top, items + totals in the center, org info + payment number at the bottom.
- **Payments + outstanding balance** — record how much a customer paid; the unpaid remainder is their balance. Payments are **tied to invoices** so each invoice shows Paid / Partially Paid / Unpaid, and the customer's balance is the sum of their invoices' remainders.

---

## 2. Scope — which features, which orgs

| Feature | Applies to |
|---------|-----------|
| **Multi-item sales** | **All** organizations (branch stores too) |
| **Customers** | All orgs (used wherever a customer is attached; required by the billing flow) |
| **Invoices** | **No-branch orgs only** (`hasStores = false`) |
| **Payments + balance** | **No-branch orgs only** |

**Layering:** `Sale` is the universal transaction (all orgs). `Invoice` + `Payment` are the **billing layer** that sits on top of a sale, only for no-branch orgs. This keeps `Sale` clean and confines billing complexity to where it's used.

---

## 3. Decisions Locked (confirmed with client)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Payment method | **None** — all mobile money; just record the amount |
| 2 | Cash vs credit | **No toggle** — the sale form has one field, **"amount paid now"**; the unpaid remainder becomes the customer's balance |
| 3 | Balance model | **Invoice-linked** — each invoice tracks `paid`/`remaining`/status; customer balance = **sum of their invoice remainders** |
| 4 | Payments | **Append-only** — each payment is a **new row**, never an update; a payment is linked to **one invoice** and cannot exceed its remaining |
| 5 | Overpayment | **Not allowed** — a payment can't push an invoice's paid above its total; balance floors at 0 |
| 6 | Customer required? | Required when a sale is **not fully paid** (someone must carry the balance); optional for a fully-paid walk-in |
| 7 | Multi-item scope | **All orgs** |
| 8 | Invoice | **Persisted + sequential number + printable** |
| 9 | Profit vs cash | **Accrual unchanged** — revenue/COGS recognized at sale; payments are cash only and never touch profit |
| 10 | Statement | **Included** — a per-customer statement (sales + payments + running balance) |

---

## 4. Current State (grounded in code)

- **No `Customer`, `Invoice`, or `Payment` models exist.** Sales are anonymous.
- **`Sale` is single-product**: `productId`, `quantitySold` (Int), `unitPrice`, `unitPurchasePrice`, `totalAmount`, `storeId`, `soldById`, `saleDate`, `status`, `note`.
- **`SaleCorrection`** references a `saleId` and corrects its single `quantity`.
- **`Organization`** has `name`, `hasStores`, `logoKey`/`logoUpdatedAt`, `isActive` — **no phone, payment number, or address.**
- No-branch orgs already sell via the admin (a hidden warehouse "store"); COGS = `product.averageCost`; branch-manager cost is stripped from responses.

---

## 5. Data-Model Changes

### 5.1 New `Customer`

```prisma
model Customer {
  id             String       @id @default(cuid())
  name           String
  phone          String?
  email          String?
  address        String?
  note           String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdById    String
  createdBy      User         @relation("CustomersCreatedBy", fields: [createdById], references: [id])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  sales    Sale[]
  invoices Invoice[]
  payments Payment[]

  @@index([organizationId])
  @@index([name])
  @@map("customer")
}
```

> Balance is **not** stored on the customer — it's **derived** = `SUM(invoice.total − invoice.paidAmount)` for that customer (single source of truth). May be cached later if needed.

### 5.2 `Sale` → header, and new `SaleItem` (the big change)

`Sale` loses its product/quantity/price fields (they move to `SaleItem`) and becomes a header.

```prisma
model Sale {
  id             String       @id @default(cuid())
  organizationId String
  storeId        String                  // selling store / warehouse (unchanged concept)
  soldById       String
  customerId     String?                 // optional; required by billing when not fully paid
  customer       Customer?    @relation(fields: [customerId], references: [id])
  totalAmount    Decimal      @db.Decimal(10, 2) // = sum of line totals (denormalized)
  saleDate       DateTime     @db.Date
  note           String?
  status         SaleStatus   @default(active)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  items       SaleItem[]
  corrections SaleCorrection[]
  invoice     Invoice?               // 1:1, no-branch orgs only

  @@index([storeId])
  @@index([customerId])
  @@index([saleDate])
  @@map("sale")
}

model SaleItem {
  id                String  @id @default(cuid())
  saleId            String
  sale              Sale    @relation(fields: [saleId], references: [id])
  productId         String
  product           Product @relation(fields: [productId], references: [id])
  quantitySold      Int
  unitPrice         Decimal @db.Decimal(10, 2)
  unitPurchasePrice Decimal @db.Decimal(10, 2) // COGS snapshot = averageCost at sale
  lineTotal         Decimal @db.Decimal(10, 2) // unitPrice × quantitySold
  organizationId    String

  @@index([saleId])
  @@index([productId])
  @@map("sale_item")
}
```

### 5.3 `SaleCorrection` — now per line

```prisma
model SaleCorrection {
  id                String   @id @default(cuid())
  saleId            String
  saleItemId        String                  // NEW — corrections target a line
  originalQuantity  Int
  correctedQuantity Int
  reason            String
  correctedById     String
  organizationId    String
  createdAt         DateTime @default(now())

  @@index([saleId])
  @@index([saleItemId])
  @@map("sale_correction")
}
```

### 5.4 New `Invoice` (no-branch orgs)

```prisma
enum InvoiceStatus { unpaid  partial  paid }

model Invoice {
  id             String        @id @default(cuid())
  saleId         String        @unique            // 1:1 with a sale
  sale           Sale          @relation(fields: [saleId], references: [id])
  customerId     String
  customer       Customer      @relation(fields: [customerId], references: [id])
  number         Int                              // sequential per org
  numberLabel    String                           // e.g. "INV-0001"
  total          Decimal       @db.Decimal(10, 2) // = sale.totalAmount at issue
  paidAmount     Decimal       @default(0) @db.Decimal(10, 2) // = SUM(payments)
  status         InvoiceStatus @default(unpaid)
  issuedAt       DateTime      @default(now())
  organizationId String

  payments Payment[]

  @@unique([organizationId, number])
  @@index([customerId])
  @@index([status])
  @@map("invoice")
}
```

- `remaining = total − paidAmount` (derived). `status` derived: `paid` when `paidAmount == total`, `partial` when `0 < paidAmount < total`, else `unpaid`.
- An invoice requires a `customerId` (billing needs a named customer).

### 5.5 New `Payment` (no-branch orgs)

```prisma
model Payment {
  id             String   @id @default(cuid())
  invoiceId      String
  invoice        Invoice  @relation(fields: [invoiceId], references: [id])
  customerId     String
  customer       Customer @relation(fields: [customerId], references: [id])
  amount         Decimal  @db.Decimal(10, 2)
  paidAt         DateTime @db.Date
  note           String?
  recordedById   String
  organizationId String
  createdAt      DateTime @default(now())

  @@index([invoiceId])
  @@index([customerId])
  @@map("payment")
}
```

- Append-only. `amount` cannot exceed the invoice's current `remaining` (no overpay).

### 5.6 `Organization` — invoice/contact fields

```prisma
model Organization {
  // ... existing ...
  phone         String?   // for invoice footer
  paymentNumber String?   // the mobile-money number customers pay to
  address       String?
  // logoKey already exists
}
```

### 5.7 New `AuditAction` values

```prisma
enum AuditAction {
  // ... existing ...
  CUSTOMER_CREATED
  CUSTOMER_UPDATED
  INVOICE_CREATED
  PAYMENT_RECORDED
}
```

### 5.8 Tenant-scoping extension

Add `"Customer"`, `"SaleItem"`, `"Invoice"`, `"Payment"` to `TENANT_MODELS` in `tenant-scoping.extension.ts`.

---

## 6. Core Mechanics

### 6.1 Recording a sale (all orgs, multi-item)

In one transaction:
1. Validate ≥1 line; each product active and in stock.
2. **Lock each product's inventory row** (product+store), check `quantity ≥ line qty`, reject naming the product if short.
3. For each line: snapshot `unitPurchasePrice = product.averageCost`; `lineTotal = unitPrice × qty`; deduct inventory.
4. `Sale.totalAmount = Σ lineTotal`. Create `Sale` + `SaleItem`s.
5. Audit `SALE_CREATED`.

### 6.2 Billing on top (no-branch orgs only)

When a no-branch org records a sale, the same transaction also:
6. **Allocates an invoice number** — increments a per-org counter under a lock (§6.4), creates `Invoice` (`total = sale.totalAmount`, `status = unpaid`).
7. Reads **"amount paid now"**:
   - `0` → invoice `unpaid`; **customer required**; remainder = balance.
   - `= total` → creates a `Payment` for the full amount; invoice `paid`; customer optional.
   - `0 < paid < total` → **customer required**; creates a `Payment`; invoice `partial`.
8. Updates `Invoice.paidAmount` + `status`. Audit `INVOICE_CREATED` (+ `PAYMENT_RECORDED` if paid > 0).

> Branch-store orgs skip steps 6–8 entirely (no invoice, no payment).

### 6.3 Recording a later payment (no-branch orgs)

- Admin records a payment against an **invoice** (default: the customer's **oldest unpaid** invoice; admin may pick another).
- `amount ≤ invoice.remaining` (no overpay). Create `Payment`, bump `Invoice.paidAmount` + recompute `status`. Audit `PAYMENT_RECORDED`.
- **One payment → one invoice.** To settle several invoices, record several payments (keeps allocation unambiguous; no split logic in v1).

### 6.4 Invoice numbering (concurrency-safe)

- A **per-org counter** (a row locked with `SELECT … FOR UPDATE`, or `Organization.nextInvoiceNumber` incremented atomically inside the sale transaction).
- `numberLabel` = `INV-` + zero-padded `number`. `@@unique([organizationId, number])` is the safety net.
- **This is the one real concurrency hot-spot** — two simultaneous sales must not get the same number. Lock the counter inside the transaction.

### 6.5 Customer balance (derived)

```
customerBalance = Σ (invoice.total − invoice.paidAmount)  for the customer's invoices
```
Always ≥ 0 (no overpay). Exposed via a query; cache only if it becomes a hotspot.

### 6.6 Profit is unaffected by payments

Revenue = `Σ SaleItem.lineTotal`; COGS = `Σ SaleItem.quantitySold × unitPurchasePrice`. Payments touch **none** of this — they only move `Invoice.paidAmount` and the derived balance.

---

## 7. Flows

| Flow | Who | Effect |
|------|-----|--------|
| Record multi-item sale | all orgs | Sale + SaleItems; deduct stock; COGS per line |
| Record sale (no-branch) | admin | + Invoice (numbered) + optional Payment (amount paid now); balance updates |
| Record later payment | admin (no-branch) | New Payment → invoice; paid/remaining/status update |
| Correct a sale line | all orgs | Per-line correction; restore stock; recompute totals (see §12.1 for invoiced sales) |
| Print invoice | admin (no-branch) | Rendered document (§10) |
| Customer statement | admin (no-branch) | Sales + payments + running balance over time |

---

## 8. Migration Plan (existing sales → header + line)

Non-destructive:
1. Create `sale_item`, `customer`, `invoice`, `payment` tables; add columns/fields.
2. **Backfill:** for every existing `Sale`, create **one `SaleItem`** from its `productId`, `quantitySold`, `unitPrice`, `unitPurchasePrice`, `lineTotal = totalAmount`.
3. **Backfill `SaleCorrection.saleItemId`** = the migrated line for that sale.
4. Drop the moved columns from `sale` (`productId`, `quantitySold`, `unitPrice`, `unitPurchasePrice`) **after** backfill (two-step, like the multitenant migration).
5. Existing orgs get **no invoices/payments** retroactively (billing starts fresh — historical anonymous sales stay as-is).
6. Existing sales get `customerId = null`.

---

## 9. Report Ripple — the biggest risk ⚠️

Every report that reads `Sale.productId / quantitySold / unitPrice / unitPurchasePrice` must move to **`SaleItem`**. Revenue-only aggregates (`Sale.totalAmount`, `saleDate`, `storeId`, `status`) can stay on the header.

Locations to rework in `reports.service.ts` (join `SaleItem → Sale` for date/store/status filters, group by `productId`):
- [ ] `buildSaleWhere` / `buildSaleSqlFilter` — now filter sale items (or join)
- [ ] `sumCogs` — `Σ saleItem.quantitySold × unitPurchasePrice`
- [ ] `fetchMonthlySales` (revenue can stay on sale; COGS moves to items)
- [ ] `fetchTopProducts` — group `SaleItem` by productId
- [ ] `fetchProductsDistribution` / `fetchProductDistributionTrend`
- [ ] `fetchStockReportRows` (sales-devices per product → from items)
- [ ] Any manager cost-stripping — now strip `SaleItem.unitPurchasePrice`
- [ ] All new raw SQL must keep `organizationId` filtering (tenant rule)

Do this as its **own phase with tests**, right after the sale restructure.

---

## 10. Invoice Document (print)

A rendered, printable view (HTML → print / PDF), three sections:
- **Top:** customer name, phone, address.
- **Center:** line items (product, qty, unit price, line total), subtotal/total, **amount paid**, **balance on this invoice**, and the customer's **overall balance**.
- **Bottom:** organization **name, logo, phone, address, and the payment number** to send mobile money to; the invoice **number** and date.

Print via the browser (dedicated print stylesheet) or server-side PDF — decide in Phase; browser print is the lean start.

---

## 11. Phased Build Plan

- **Phase 1 — Customers:** `Customer` entity + CRUD + search + tenant scoping; `customerId` on `Sale` (optional). Customer profile (details + sales + balance placeholder).
- **Phase 2 — Multi-item sales:** `Sale` header + `SaleItem`; multi-product transaction (lock each, per-line COGS); per-line `SaleCorrection`; **migration** (§8).
- **Phase 3 — Report rewrite:** move all product/COGS aggregates to `SaleItem` (§9) + tests.
- **Phase 4 — Org invoice info:** `phone`, `paymentNumber`, `address` on `Organization` + settings UI.
- **Phase 5 — Invoices (no-branch):** `Invoice` entity + concurrency-safe numbering; auto-generated from a no-branch sale; printable document.
- **Phase 6 — Payments & balance (no-branch):** "amount paid now" on the sale; `Payment` entity; later payments (oldest-unpaid default); invoice paid/remaining/status; **derived customer balance**; receivables list; **customer statement**.
- **Phase 7 — Test & verify** end-to-end.

---

## 12. Things to Be Careful About (critical)

1. **Correcting an *invoiced* sale (§7).** Reducing a line lowers `Sale.totalAmount`, which lowers `Invoice.total`. If the invoice was already paid past the new total, that's an implied **overpayment/refund** — which we said we don't allow. **Rule to decide (open):** either *block* a correction that would drop `total` below `paidAmount`, or allow it and surface a **"refund due"** flag. Recommend: **block with a clear message** in v1.
2. **Invoice numbering concurrency (§6.4).** Two concurrent sales must not collide — lock the per-org counter inside the transaction; keep `@@unique([organizationId, number])` as the guard.
3. **Report ripple (§9).** The single biggest risk. A missed query silently reports wrong product/COGS numbers. Treat as security-grade care + tests.
4. **"Customer required when not fully paid."** Enforce on the **backend**, not just UI — an unpaid sale with no customer creates an owner-less balance.
5. **Multi-item stock deduction is atomic.** Lock **every** line's inventory row; if any line is short, the **whole** sale fails (no partial deduction).
6. **Manager cost-hiding moves to `SaleItem`.** Don't leak `unitPurchasePrice` in item responses to branch managers.
7. **No overpay is enforced server-side** on every payment (`amount ≤ remaining`), including the "amount paid now" at sale.
8. **Accrual stays accrual.** Never let a payment change revenue/COGS/profit — only `Invoice.paidAmount` + derived balance.

---

## 13. Open Decisions — RESOLVED ✅ (confirmed with client)

- [x] **Correcting an invoiced sale** — **BLOCK** the correction if it would drop the invoice total below the amount already paid (clear error message). (§12.1)
- [x] **Later-payment allocation** — **default to the customer's oldest unpaid invoice**, with the option to pick another.
- [x] **Invoice printing** — **browser print first** (dedicated print stylesheet); server-side PDF can come later.
- [x] **Branch-store orgs & customers** — **leave `customerId` unused** there; customers are attached only in the no-branch billing flow.

## 14. Note — Accrual (revenue/profit) vs cash (payments)

Revenue and profit are recognized **in full at the moment of the sale**, regardless of how much the customer has paid (accrual). A partial-payment or unpaid sale still counts its **full** revenue and COGS in profit reports **immediately**. Payments only move cash from "owed" to "collected" (`Invoice.paidAmount` + derived balance) and **never** create or change profit. Nothing waits for full payment.
