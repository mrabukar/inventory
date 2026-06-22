# Purchase Correction (Void Mistaken Purchases) — Design Document

> **Status:** Design complete — implementation not started.
> **Last updated:** 2026-06-22
> **Purpose:** Add a proper **purchase correction** so a mistaken purchase reverses *consistently everywhere* (purchased count, stock investment, average cost, inventory) — and stop overloading the warehouse "write-off", which should only be for genuine losses. Companion to `PURCHASING_DESIGN.md`.

---

## 1. Background — one button doing two opposite jobs

Today, removing stock from the warehouse (`writeOffWarehouseStock`) only **reduces inventory quantity** and writes an audit log. It does **not** touch the `purchase` ledger, `averageCost`, or stock investment.

That's fine for one situation but wrong for another:

| Situation | Did you really buy them? | Correct treatment |
|-----------|--------------------------|-------------------|
| **Real loss** (damaged, stolen, shrinkage) | Yes | Reduce inventory only. Purchases/spend stay — you did pay. ✅ today's write-off |
| **Mistaken purchase** (entered 20, only bought 18) | No | Reverse the purchase: ↓ inventory **and** ↓ purchased count **and** ↓ stock investment **and** recompute `averageCost` |

The current write-off (labelled *"clear mistaken purchases"*) is being used for the **mistaken-purchase** case, but it only fixes inventory — leaving purchases and financials overstated. Symptom: Stock Report shows *Purchased 20 / In stock 18* with no explanation.

**Fix:** split the two intents.
- **Keep** the warehouse write-off for genuine losses (relabel it so its purpose is clear).
- **Add** a purchase correction that reverses a purchase consistently across the whole system.

---

## 2. Approach (decisions)

| Decision | Choice | Why |
|----------|--------|-----|
| Model the correction | A **negative `Purchase` row** of `type = correction`, linked to the original via `correctsPurchaseId` | Mirrors the existing `StockSupply` correction pattern; reports that `SUM(quantity)`/`SUM(totalCost)` **net out automatically** |
| Where it lives | A **"Correct / Void"** action on a purchase in the Purchases list / product purchase history | The natural place to fix a specific purchase |
| Average cost | Recompute by **removing the corrected units at the original purchase's unit price** (inverse of the weighted-average blend) | Symmetric with how cost was added; exact when no activity intervened (see §3) |
| Stock source | Units must still be in the **warehouse** | You can't un-buy units already distributed to stores or sold |
| Reason | **Required** note on every correction | Audit trail, same as stock-supply corrections |
| Write-off | **Keep** for losses; **relabel** UI from "clear mistaken purchases" → "write off lost/damaged stock" | Steer mistakes to the new flow |
| Below-zero guards | Clamp/guard so `averageCost` and quantities can't go negative | Safety for edge cases |

---

## 3. The weighted-average reversal — math (the important part)

Reversing a purchase under **moving weighted average** means removing the corrected units' value from the on-hand value pool, at the **price recorded on the purchase being corrected**:

```
onHand        = current total on-hand units for the product (warehouse + all stores)
currentValue  = onHand × product.averageCost
removedValue  = correctedQty × original.unitPurchasePrice
newOnHand     = onHand − correctedQty
newAverage    = newOnHand > 0 ? (currentValue − removedValue) / newOnHand : 0
```

Round to 2 decimals (money). Guard: if `removedValue ≥ currentValue` (would push average ≤ 0), clamp `newAverage` to `0` and flag the correction (see §9).

### Worked example A — same price (the Nokia case)

- Bought **20 @ 100** → `averageCost = 100`, warehouse 20.
- Correct **2** mistaken units:
  - `currentValue = 20 × 100 = 2000`; `removedValue = 2 × 100 = 200`
  - `newAverage = (2000 − 200) / 18 = 100` (unchanged — same price)
  - Warehouse 20 → **18**; Purchase correction row: `qty −2, totalCost −200`
  - **Stock Report:** Purchased `20 + (−2) = 18`, In stock `18`, stock investment nets `−200`. **All consistent.** ✅

### Worked example B — price changed (proves it's exact)

- Buy 10 @ 100 → avg 100 (value 1000, onHand 10)
- Buy 10 @ 120 → avg 110 (value 2200, onHand 20)
- The second purchase was wrong (should've been 8). Correct **2** of the @120 line:
  - `currentValue = 20 × 110 = 2200`; `removedValue = 2 × 120 = 240`
  - `newAverage = (2200 − 240) / 18 = 108.89`
  - **Check:** true pool is `10@100 + 8@120 = 1960` over 18 = `108.89`. **Exact.** ✅

> This is exact when nothing happened between the purchase and its correction. If sales/distributions occurred in between, it's a close approximation — an inherent property of weighted-average costing (it doesn't track batches). Documented in §9.

---

## 4. Schema Changes

### 4.1 `Purchase` — add type + link (in `purchase.prisma`)

```prisma
enum PurchaseType {
  purchase
  correction
}

model Purchase {
  // ... existing fields ...
  type             PurchaseType @default(purchase)   // existing rows = purchase
  correctsPurchaseId String?
  correctsPurchase   Purchase?  @relation("PurchaseCorrection", fields: [correctsPurchaseId], references: [id])
  corrections        Purchase[] @relation("PurchaseCorrection")

  @@index([type])
  @@index([correctsPurchaseId])
}
```

**Correction row convention** (mirrors `StockSupply` corrections):
- `quantity` = **negative** (units removed)
- `totalCost` = **negative** (`quantity × unitPurchasePrice`)
- `unitPurchasePrice` = the **original** purchase's unit price
- `type = correction`, `correctsPurchaseId` = original id, `note` = reason (required)

### 4.2 `AuditAction`

```prisma
enum AuditAction {
  // ... existing ...
  PURCHASE_CORRECTED
}
```

---

## 5. Flows

### 5.1 Correct a purchase — `POST /api/purchases/:id/correct` (admin)

Input: `quantity` (units to reverse), `reason` (required).

1. Load the original purchase (org-scoped); must be `type = purchase`.
2. Validate `quantity` ≤ (original `quantity` − already-corrected against it) and `quantity > 0`.
3. Resolve warehouse; in a transaction (lock warehouse + product):
   - Require warehouse on-hand ≥ `quantity` (else reject — pull stock back first).
   - Compute `newAverage` (§3) using the original's `unitPurchasePrice`.
   - Create a **correction** `Purchase` row: `quantity = −q`, `totalCost = −(q × origPrice)`, `unitPurchasePrice = origPrice`, `type = correction`, `correctsPurchaseId`, `note = reason`.
   - Decrement warehouse inventory by `q`.
   - Update `product.averageCost = newAverage`.
   - Audit: `PURCHASE_CORRECTED` + `INVENTORY_UPDATED` + `PRODUCT_COST_RECALCULATED`.
4. Return the original purchase with its corrections + updated product cost.

### 5.2 Warehouse write-off — keep for losses (relabel only)

- Backend `writeOffWarehouseStock` is unchanged (inventory-only, for real losses).
- **UI copy changes:** modal title/description from *"clear mistaken purchases"* → *"Write off lost or damaged stock"*; add a hint: *"Bought by mistake? Use 'Correct purchase' instead so cost and reports update."*

---

## 6. Backend Changes — File by File

- [ ] `purchase.prisma` — add `PurchaseType`, `type`, `correctsPurchaseId` self-relation (§4.1)
- [ ] `audit.prisma` — add `PURCHASE_CORRECTED`
- [ ] Migration: add enum + columns (default `type = purchase` for existing rows)
- [ ] `weighted-average.util.ts` — add `reverseWeightedAverageCost(onHand, avg, qty, origUnitPrice)` (§3) with the ≤0 guard + unit tests (mirror the existing spec, including examples A & B)
- [ ] `purchases.service.ts` — `correct(purchaseId, dto, user)` (§5.1); helper to sum prior corrections for a purchase
- [ ] `dto/correct-purchase.dto.ts` — `quantity`, `reason`
- [ ] `purchases.controller.ts` — `POST /purchases/:id/correct` (`@Roles(admin)`)
- [ ] `purchases.service.findAll` / history — include corrections (they're rows); show net per product
- [ ] No reports change needed — `SUM(quantity)` / `SUM(totalCost)` already net corrections; **verify** the Stock Report and stock-investment now reconcile

---

## 7. Frontend Changes

- [ ] **Purchases list / product purchase history**: a **"Correct / Void"** action per purchase row → modal: units to reverse (max = remaining), reason (required), live preview of the new average cost and the resulting purchased/stock numbers
- [ ] Show correction rows in history (e.g. a "−2 correction" line linked to the original), like stock-supply corrections
- [ ] **Warehouse "Remove stock" modal**: relabel to "Write off lost/damaged stock" + hint pointing to "Correct purchase" for mistakes
- [ ] Types + TanStack Query hook for `POST /purchases/:id/correct`

---

## 8. Reporting impact (this is what fixes the original symptom)

Because a correction is a **negative purchase row**:

| Metric | Before fix (write-off only) | After fix (purchase correction) |
|--------|-----------------------------|---------------------------------|
| Stock Report "Purchase devices" | 20 (wrong for a mistake) | **18** — `20 + (−2)` nets automatically |
| In stock | 18 | 18 |
| Stock investment (period) | overstated | **correct** — `totalCost` nets `−200` |
| `averageCost` | unchanged | **recomputed** consistently |

So the Nokia report becomes *Purchased 18 / In stock 18* — **correctly**, and only when the admin uses "Correct purchase" (genuine losses still keep purchases intact via write-off).

---

## 9. Things to Be Careful About

1. **Can't reverse units that already left the warehouse.** If the mistaken units were distributed to stores or sold, block the correction (or require pulling them back first). Warehouse on-hand must cover the reversed quantity.
2. **Average-cost reversal is exact only with no intervening activity.** With sales/purchases in between, it's a defensible approximation (weighted average doesn't track batches — by design). Guard `newAverage ≥ 0` and flag clamped cases in the audit.
3. **Don't over-correct a purchase.** Track the sum of prior corrections against a purchase; the new reversal can't exceed the remaining un-corrected quantity.
4. **Corrections are immutable** (like all corrections) — no editing; a wrong correction is itself another adjustment.
5. **Keep COGS history intact.** Past sales keep their original `unitPurchasePrice` snapshot; correcting a purchase changes the *current* `averageCost` going forward, never historical sales.
6. **Reports already net corrections** via `SUM(quantity)`/`SUM(totalCost)` — make sure no report counts only `type = purchase` and accidentally ignores corrections (or only counts positives).
7. **Relabel, don't remove, the write-off.** Genuine losses still need it; purchases must stay intact for those.

---

## 10. Open Decisions

- [x] **Partial vs full:** **Partial reversal allowed** (reverse part of a purchase).
- [x] **Which purchases:** **Any purchase** can be corrected (with the §9.2 approximation caveat + `averageCost ≥ 0` guard + audit flag).
- [x] **Record loss value for write-offs (shrinkage)?** — **Deferred** (future optional follow-up). Genuine write-offs keep reducing inventory only for now; if losses become material, revisit recording the lost value as a shrinkage expense so it shows in profit. Does **not** block this work.
