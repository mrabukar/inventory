# Batch Purchase (Multi-Item) — Design Document

> **Status:** Planned — not yet implemented
> **Created:** 2026-08-14
> **Purpose:** Replace the one-product-at-a-time purchase modal with a full-page multi-item
> form so a real vendor invoice (many products, one date, one reference number) can be
> recorded in a single submit.

---

## 1. Background & Motivation

The current flow forces the user to:

1. Click "Record Purchase" → fill one product → Save → close modal
2. Click "Record Purchase" again → fill next product → Save → close modal
3. Repeat for every line on the vendor invoice

In reality a vendor invoice (see example receipt: Invoice 15003, four products, one date,
one total) is one event. Recording it as separate unrelated rows is tedious and error-prone.

**Goal:** open one full-page form, fill all product rows sharing the same date/invoice
number/note, submit once — all items land atomically.

---

## 2. Decisions Locked

| # | Decision | Choice | Reason |
|---|----------|--------|--------|
| 1 | UI shape | **Full page** (not a wider modal) | Multiple rows need vertical space; mirrors submit-sale UX |
| 2 | Schema | **No migration** — `Purchase` rows stay flat, one row per product | Adding a PurchaseOrder header is a separate future concern if reporting ever needs it |
| 3 | New endpoint | `POST /purchases/batch` (additive); old `POST /purchases` kept intact | No breaking change for any code already calling the single endpoint |
| 4 | Atomic | All items in **one transaction** — all succeed or all roll back | Partial inserts would leave inventory in an inconsistent state |
| 5 | Duplicate products | **Rejected** in a single batch (frontend + backend) | Would require sequencing average-cost updates within the same tx; complexity not worth it — record a second batch or a correction instead |
| 6 | Weighted-average | Computed **per product independently** inside the transaction — same formula as today | Products are independent; order of processing within the batch does not matter |
| 7 | Correction flow | **Unchanged** — corrections still target individual `Purchase` rows | Each batch item is its own row; the fix chooser/fix modal need no changes |
| 8 | Selling price | **Per row** — each item can optionally update that product's selling price | Same as today; each product has its own price |
| 9 | Loss confirmation | Single **per-submit** acknowledgement listing all loss-selling rows | Simpler than one confirmation dialog per row |

---

## 3. Current State (Grounded in Code)

### 3.1 Backend

**Model** (`api/prisma/models/purchase.prisma`):
```
Purchase {
  id, productId, organizationId, quantity, unitPurchasePrice, totalCost,
  type (purchase|correction), correctsPurchaseId, invoiceNumber, purchaseDate,
  note, purchasedById, createdAt
}
```

**Existing endpoints** (`purchases.controller.ts`):
- `GET  /purchases` — list with filters
- `POST /purchases` — create single (calls `PurchasesService.create`)
- `POST /purchases/:id/correct/add`
- `POST /purchases/:id/correct/subtract`
- `POST /purchases/:id/correct` (deprecated alias)

**`PurchasesService.create()` flow** (single item):
1. Fetch product; parse date; compute `unitPurchasePrice`, `totalCost`
2. Resolve org warehouse (`ensureOrgWarehouse`)
3. Open transaction:
   a. `lockInventoryForMutation` → `SELECT FOR UPDATE` on the warehouse inventory row
   b. `inventory.aggregate` → `onHand` = sum across ALL inventory for this product+org
   c. Re-read `product.averageCost` inside lock (concurrent-purchase safety)
   d. `computeWeightedAverageCost(onHand, currentAvg, qty, unitCost)` → `newAverage`
   e. `purchase.create`
   f. `inventory.update` (or create if first time in warehouse)
   g. `product.update` → `averageCost = newAverage`, optionally `sellingPrice`
   h. Three audit log entries: PURCHASE_CREATED, INVENTORY_UPDATED, optionally PRODUCT_COST_RECALCULATED
4. Return purchase with updated product

**Correction flow** (`correctAdd` / `correctSubtract`):
- Loads original `Purchase` row by id; validates `type === purchase`
- For subtract: checks `reversibleQuantity` (original.qty + sum of prior correction qtys) and warehouse stock
- Uses original row's `unitPurchasePrice` for the average-cost adjustment
- Creates a new `Purchase` row with `type=correction`, `correctsPurchaseId=original.id`,
  `quantity` positive (add) or negative (subtract)
- Runs same lock → aggregate → compute → update cycle

### 3.2 Frontend

**Files involved:**
```
web/app/(app)/purchases/
  page.tsx                             ← orchestrates everything
  components/purchase-modal.tsx        ← REPLACED by new full page
  components/purchase-fix-chooser-modal.tsx  ← UNCHANGED
  components/purchase-fix-modal.tsx          ← UNCHANGED
  components/purchase-table.tsx              ← UNCHANGED

web/types/purchases/purchase.ts        ← ADD new batch types
web/service/purchases/create-purchase.ts    ← EXISTS (single); ADD batch service
web/hooks/purchases/use-create-purchase.ts  ← EXISTS (single); ADD batch hook
web/lib/purchases/weighted-average.ts       ← UNCHANGED
web/lib/purchases/reversible-quantity.ts    ← UNCHANGED
```

**Current `purchase-modal.tsx` — what it does per product:**
- Product picker (Combobox from `useProducts`)
- Quantity input
- Unit purchase price input → auto-enables "Update selling price" if cost > current selling price
- Date input
- Invoice number (optional)
- Note (optional)
- "Update selling price" checkbox → reveals new selling price input
- Live preview panel: computed `newAverage`, margin %, warning if margin < 0
- Loss confirmation dialog before save

---

## 4. Weighted-Average Correctness Analysis

### 4.1 Why batch is safe

Each product has its own independent `averageCost` stored on its `Product` row. When
processing a batch of N different products:

```
Item 1 (Product A): newAvgA = WA(onHand_A, avgCost_A, qty1, cost1) → update Product A
Item 2 (Product B): newAvgB = WA(onHand_B, avgCost_B, qty2, cost2) → update Product B
...
```

Product A's average has zero effect on Product B's average. **Order within the batch does
not matter for correctness.** All computations are independent.

### 4.2 The one risk: duplicate products

If the same product appears twice in one batch, item 2 would see the `averageCost` that
item 1 already updated (inside the same tx), but `onHand` would also have been incremented
by item 1. In that case the formula is still correct mathematically — but it means the two
rows have different `unitPurchasePrice` values for the same buy event, which would make
corrections confusing (which row do you correct?).

**Decision: reject duplicate `productId`s in a batch.** Frontend deduplication error +
backend validation error (`400 Bad Request`).

### 4.3 Concurrency safety

Same as today: `lockInventoryForMutation` issues `SELECT ... FOR UPDATE` on the warehouse
inventory row per product inside the transaction. Two concurrent batch submits for the same
product will serialize correctly — the second waits for the first to commit, then re-reads
the updated `averageCost`.

### 4.4 The formula (unchanged)

```
onHand      = SUM(inventory.quantity) WHERE productId = X AND organizationId = org
              (warehouse + all stores combined)
oldValue    = onHand × currentAverageCost
newValue    = oldValue + (purchaseQty × purchaseUnitCost)
newOnHand   = onHand + purchaseQty
newAverage  = newOnHand > 0 ? round(newValue / newOnHand, 2) : purchaseUnitCost
```

If `onHand = 0` (first ever purchase of this product), `newAverage = purchaseUnitCost`.

---

## 5. Backend — What to Build

### 5.1 New DTOs

**`dto/create-purchase-batch-item.dto.ts`**
```typescript
class CreatePurchaseBatchItemDto {
  productId: string           // required, non-empty string
  quantity: number            // required, positive integer
  unitPurchasePrice: number   // required, positive, max 2 decimals
  newSellingPrice?: number    // optional, positive, max 2 decimals
  acceptSellingBelowCost?: boolean  // optional, default false
}
```

**`dto/create-purchase-batch.dto.ts`**
```typescript
class CreatePurchaseBatchDto {
  purchaseDate: string              // required, YYYY-MM-DD
  items: CreatePurchaseBatchItemDto[]  // required, minLength 1, maxLength 50
  invoiceNumber?: string            // optional, maxLength 100
  note?: string                     // optional, maxLength 500
}
```

**Custom validator needed on `items`:** reject duplicate `productId`s.
Use a `@IsDuplicateFree('productId')` class-validator decorator or inline
`@Validate(NoDuplicateProductsConstraint)`.

### 5.2 New Service Method

**`PurchasesService.createBatch(dto, user): Promise<PurchaseCreateResult[]>`**

```
1. Validate date (reuse parseAndValidatePurchaseDate)
2. Resolve org warehouse (ensureOrgWarehouse) — once, shared by all items
3. For each item, fetch product (fails fast if any productId is invalid before tx starts)
4. Open ONE transaction (MUTATION_TRANSACTION_OPTIONS):
   For each item IN ORDER:
     a. lockInventoryForMutation(tx, orgId, productId, warehouseId)
     b. aggregate onHand for this productId across org
     c. tx.product.findUniqueOrThrow → lockedAverageCost (inside lock)
     d. computeWeightedAverageCost → newAverage
     e. Resolve sellingPrice (same logic as single create)
     f. assertSellingPriceNotBelowPurchase if newSellingPrice given and !acceptSellingBelowCost
     g. tx.purchase.create
     h. tx.inventory.update or create
     i. tx.product.update (averageCost, optionally sellingPrice)
     j. tx.auditLog.create × 2 or 3 (PURCHASE_CREATED, INVENTORY_UPDATED,
        optionally PRODUCT_COST_RECALCULATED)
5. Return array of created purchase rows (with product included)
```

**Why process items inside the transaction sequentially (not in parallel)?**
Concurrent `tx.product.update` calls within the same Prisma tx would race on the same row.
Sequential guarantees each lock/compute/update cycle sees the latest state from the
previous item. For different products this doesn't matter for correctness, but it prevents
unexpected Prisma behavior on concurrent writes to different rows within one tx.

### 5.3 New Controller Endpoint

```typescript
@Post("batch")
@HttpCode(HttpStatus.CREATED)
createBatch(
  @Body() dto: CreatePurchaseBatchDto,
  @CurrentUser() user: CurrentUserPayload,
) {
  return this.purchasesService.createBatch(dto, user);
}
```

Placed **before** the `:id` parameterised routes so `batch` is not misread as an id.

### 5.4 Response

Returns `PurchaseCreateResult[]` — same shape as a single create but an array.
Each element contains the created `Purchase` + the updated `Product` (with new `averageCost`
and `sellingPrice`).

### 5.5 Error cases

| Situation | Response |
|-----------|----------|
| `items` is empty or missing | 400 — validation |
| Duplicate `productId` in items | 400 — "Duplicate product in batch: {name}" |
| Any `productId` not found | 404 — fails before transaction opens |
| `newSellingPrice` < `unitPurchasePrice` and `!acceptSellingBelowCost` | 400 — same as today |
| Any step inside the tx fails | Transaction rolls back; all items undone |

---

## 6. Frontend — What to Build

### 6.1 Page structure

The "Record Purchase" button on `purchases/page.tsx` navigates to a new route:

```
web/app/(app)/purchases/new/page.tsx   ← new full-page form
```

On save/cancel it navigates back to `/purchases`.

The existing `PurchaseModal` component is removed from `page.tsx`. The "Record Purchase"
button becomes a `<Link href="/purchases/new">` (or `router.push`).

### 6.2 Route & file

```
web/app/(app)/purchases/new/
  page.tsx   ← "Record Purchase" full-page form
```

### 6.3 Page layout

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Purchases          Record Purchase         │
│                                                      │
│  Purchase Date *   [date input]                      │
│  Invoice No.       [text input — optional]           │
│  Note              [textarea — optional]             │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Product        Qty   Unit Cost   Sell.Price  │   │
│  │ [Combobox]    [n]   [0.00]      [0.00] ☐   │   │
│  │ [preview: new avg X.XX · margin Y%]          │   │
│  │ [Combobox]    [n]   [0.00]      [0.00] ☐   │   │
│  │ ...                                          │   │
│  │ + Add item                                   │   │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [warning banner if any row sells at a loss]         │
│                                                      │
│              [Cancel]   [Record X purchases]         │
└─────────────────────────────────────────────────────┘
```

### 6.4 Shared header fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Purchase Date | date input | Yes | Defaults to today |
| Invoice Number | text | No | Vendor's invoice/receipt number. Max 100 chars. Shown on each resulting Purchase row |
| Note | textarea | No | Applies to all items as a shared note. Max 500 chars |

### 6.5 Per-row fields

Each row represents one `Purchase` to be created.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Product | Combobox | Yes | From `useProducts({ limit: 200 })`; excludes products already selected in other rows |
| Quantity | number input | Yes | Positive integer |
| Unit Cost | number input | Yes | What you paid the vendor per unit. Pre-fills with `product.averageCost` as a hint (same as today) |
| Update Selling Price | checkbox | No | Defaults to auto-checked if unit cost > current selling price (same as today) |
| New Selling Price | number input | Conditional | Shown only when checkbox is checked. Pre-fills with current selling price or unit cost if higher |
| Remove row button | icon button | — | Disabled when only 1 row remains |

### 6.6 Per-row live preview

Below each row (collapsible / shown when qty + cost are filled):
```
New avg cost: X.XX  ·  At selling price Y.YY → margin Z%
```
Warning state (red) when margin < 0 or unit cost > selling price.

Uses the same `computeWeightedAverageCost` + `grossMarginPercent` already in
`web/lib/purchases/weighted-average.ts`. Fetches `onHand` per product via `useInventory`.

### 6.7 Duplicate product guard

When a product is selected in row N, it is **excluded** from the Combobox options in all
other rows. If a product is selected in row N and the user somehow triggers a duplicate
(shouldn't happen with filtered combobox), show inline row error: "This product is already
in another row."

### 6.8 Loss/margin confirmation

Before submitting, if ANY row has `unitCost > effectiveSellingPrice`, show ONE confirmation:

```
Selling at a loss on some items

The following items have a unit cost above the selling price:
  • Samsung A17 128GB — cost 133.00, selling 130.00
  • Spark 50 — cost 125.00, selling 120.00

The purchase will still be recorded. Review selling prices after saving.

[Cancel]   [Record anyway]
```

Clicking "Record anyway" sets `acceptSellingBelowCost: true` on those specific items before
calling the API.

### 6.9 Submit button label

Dynamic: `"Record 1 purchase"` / `"Record 3 purchases"` — count of valid rows.
Disabled when: no rows, any row has a validation error, or submission is in flight.

### 6.10 State shape (TypeScript)

```typescript
interface PurchaseRow {
  id: string                  // local uuid for React key, not sent to API
  productId: string
  quantity: string            // kept as string for input; parsed on submit
  unitPurchasePrice: string
  updateSellingPrice: boolean
  newSellingPrice: string
  // derived / display only
  error: Partial<Record<"productId"|"quantity"|"unitPurchasePrice"|"newSellingPrice", string>>
}

interface PageState {
  purchaseDate: string        // YYYY-MM-DD, default today
  invoiceNumber: string
  note: string
  rows: PurchaseRow[]
}
```

### 6.11 Validation on submit (frontend)

1. `purchaseDate` must be non-empty
2. Each row: `productId` non-empty, `quantity` positive integer, `unitPurchasePrice` positive
3. Each row with `updateSellingPrice=true`: `newSellingPrice` positive
4. No duplicate `productId` across rows

Validation runs before calling the API. If any row fails, errors are shown inline on that
row and submit is blocked.

### 6.12 Success flow

On successful API response:
- Show toast: `"X purchases recorded"` (where X = items count)
- Navigate to `/purchases`
- React Query cache is invalidated for: `["purchases"]`, `["inventory"]`,
  `["warehouse-inventory"]`, `["products"]`, all report queries

### 6.13 Error flow

On API error:
- Show error toast with message
- Stay on the form (don't navigate away) so user can fix and retry
- The transaction rolled back, so nothing was saved — safe to retry

---

## 7. New Types (web/types/purchases/purchase.ts additions)

```typescript
export interface CreatePurchaseBatchItemInput {
  productId: string
  quantity: number
  unitPurchasePrice: number
  newSellingPrice?: number
  acceptSellingBelowCost?: boolean
}

export interface CreatePurchaseBatchInput {
  purchaseDate: string
  invoiceNumber?: string
  note?: string
  items: CreatePurchaseBatchItemInput[]
}

export type CreatePurchaseBatchResponse = (Purchase & { product: Product })[]
```

---

## 8. New Service (web/service/purchases/create-purchase-batch.ts)

```typescript
export function createPurchaseBatch(
  input: CreatePurchaseBatchInput,
): Promise<CreatePurchaseBatchResponse> {
  return apiFetch<CreatePurchaseBatchResponse>("/api/purchases/batch", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
```

---

## 9. New Hook (web/hooks/purchases/use-create-purchase-batch.ts)

```typescript
export function useCreatePurchaseBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPurchaseBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["warehouse-inventory"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      invalidateReportQueries(queryClient)
    },
  })
}
```

Note: `onSuccess` receives an array now, not a single purchase, so we can't
`invalidateQueries` per productId (too many). Invalidating the whole `["purchases"]`
and `["products"]` keys is correct and sufficient.

---

## 10. Files Changed / Added

### Backend

| File | Change |
|------|--------|
| `api/src/modules/purchases/dto/create-purchase-batch-item.dto.ts` | **NEW** |
| `api/src/modules/purchases/dto/create-purchase-batch.dto.ts` | **NEW** |
| `api/src/modules/purchases/purchases.service.ts` | **ADD** `createBatch()` method |
| `api/src/modules/purchases/purchases.controller.ts` | **ADD** `POST batch` endpoint (before `:id` routes) |

No schema migration. No changes to `weighted-average.util.ts`, `correct-purchase.dto.ts`,
correction methods, or any other existing files.

### Frontend

| File | Change |
|------|--------|
| `web/types/purchases/purchase.ts` | **ADD** batch input/response types |
| `web/service/purchases/create-purchase-batch.ts` | **NEW** |
| `web/hooks/purchases/use-create-purchase-batch.ts` | **NEW** |
| `web/app/(app)/purchases/new/page.tsx` | **NEW** — full-page multi-item form |
| `web/app/(app)/purchases/page.tsx` | **EDIT** — change "Record Purchase" button to link to `/purchases/new`; remove `PurchaseModal` usage; remove `showCreate` state; remove `useCreatePurchase` import |
| `web/app/(app)/purchases/components/purchase-modal.tsx` | **DELETE** — replaced by the new page |

No changes to:
- `purchase-table.tsx`
- `purchase-fix-chooser-modal.tsx`
- `purchase-fix-modal.tsx`
- `use-correct-purchase.ts`
- `use-create-purchase.ts` (single-item hook; kept, but no longer used by the purchases page)
- Any correction-related backend files
- Any schema / migration files

---

## 11. Correction Flow (Unchanged — documented for completeness)

After a batch is recorded, each item lands as an individual `Purchase` row in the list
(one row per product). The existing "Fix" button on each row works exactly as today:

1. Click "Fix" on a row → `PurchaseFixChooserModal` (choose Add or Remove)
2. Choose → `PurchaseFixModal` (enter qty + reason, see preview)
3. Submit → `POST /purchases/:id/correct/add` or `/subtract`
4. Backend creates a `type=correction` row linked to the original via `correctsPurchaseId`
5. Uses the **original row's `unitPurchasePrice`** to adjust the average cost

**`reversibleQuantity`** on each row correctly reflects net correctable units
(original qty + sum of all correction qtys for that row). This is unaffected by
whether the row came from a single or batch create.

---

## 12. Edge Cases & Guards

| Case | Handling |
|------|----------|
| User submits batch with 1 item | Valid — same as old single modal, just via new endpoint |
| Product has no existing inventory (first purchase) | `onHand = 0`; `newAverage = unitCost` — same as today |
| Two admins submit batches containing the same product at the same time | Serialised by `SELECT FOR UPDATE` inside transaction; second tx reads the updated averageCost after first commits |
| User navigates away mid-form | Browser confirms (if we add a `beforeunload` guard) or they just lose their draft — same as submit-sale page today |
| API down mid-submit | Full rollback; error toast; user stays on form to retry |
| 50 items in one batch | Accepted (maxLength 50 on items array); tx may be slow but safe |

---

## 13. Out of Scope (Not in This Feature)

- Vendor entity (named vendors linked to purchases) — future
- Purchase order header as a DB entity — future
- Grouping the purchases list by invoice number — future
- Editing a submitted purchase — not planned (use corrections)
- Receiving / warehousing workflow (GRN) — not planned

---

## 14. Implementation Order

1. **Backend first:**
   - `create-purchase-batch-item.dto.ts`
   - `create-purchase-batch.dto.ts` (with no-duplicate validator)
   - `PurchasesService.createBatch()`
   - `POST /purchases/batch` endpoint
   - Run existing tests; add a test for the batch method

2. **Frontend second:**
   - Add batch types to `purchase.ts`
   - `service/purchases/create-purchase-batch.ts`
   - `hooks/purchases/use-create-purchase-batch.ts`
   - `app/(app)/purchases/new/page.tsx` (the new form)
   - Edit `purchases/page.tsx` (swap button → link, remove modal)
   - Delete `purchase-modal.tsx`

3. **Verify end-to-end:**
   - Record a 4-item batch; confirm 4 Purchase rows in list, all with correct invoice number
   - Confirm each product's `averageCost` updated correctly
   - Fix one row; confirm correction applies only to that row, averageCost recalculates
   - Record a second batch with a product already purchased; confirm average blends correctly
