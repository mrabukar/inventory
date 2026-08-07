# Petrol / Gas Station Management — System Design

> **Status:** Design — greenfield project, not started.
> **Last updated:** 2026-06-22
> **Purpose:** Full system design for a new multi-tenant petrol/gas station management platform, adapted from the existing inventory system. Reference this to scaffold and build phase by phase.

---

## 1. Overview & Goal

A **multi-tenant platform for petrol/gas stations**. Each tenant (company) runs a **central depot** where fuel and goods are purchased, and several **stations** where they are sold — a **main station** operated by the admin plus **branch stations** operated by managers. It tracks purchasing, per-location stock and cost, daily-changing retail prices, retail and negotiated wholesale sales, expenses, and profit.

It shares ~80% of its foundation with the inventory system. The genuinely new parts are: **decimal quantities (liters)**, **per-location (per-station) weighted-average cost**, **a central depot that distributes cost into stations**, **daily retail price history**, and **retail vs negotiated wholesale pricing**.

---

## 2. What's reused vs what's new

| Reused from inventory (adapt) | New / changed for gas stations |
|-------------------------------|--------------------------------|
| Multi-tenancy (orgs, super-admin, admin, managers), tenant-scoping Prisma extension | Depot as a distinct central location (not a hidden warehouse) |
| Purchasing + weighted-average cost + **purchase corrections** | Cost is **per-location**, not org-level |
| Distribution (stock-supply → distribute) | Distribution **carries cost** into the receiving station's average |
| Categories, products, expenses, audit logs, reports | **Per-product unit of measure** (liter / unit), **decimal** quantities |
| Customers (retail/wholesale), sale corrections | **Retail price history** (effective-dated, per-station) |
| Sales flow, below-cost "warn + confirm" guard | **Retail vs wholesale**; wholesale **negotiated fresh** per sale |
| Same stack (NestJS + Next.js + Prisma + Postgres) | Admin can **sell** (runs the main station); both roles do retail + wholesale |

---

## 3. Tech Stack

Identical to the inventory system: **NestJS 11 + Prisma 6 + PostgreSQL** (API), **Next.js 16 + React 19 + TanStack Query/Table + Tailwind + shadcn/ui** (web), tenant-scoping via a Prisma client extension, session auth via Better-Auth.

---

## 4. Roles & Multi-Tenancy

Same model as inventory (`MULTITENANT_DESIGN.md`):

```
super_admin        platform; manages organizations; no org
  └── admin        tenant; runs the MAIN station; full access across the org
        └── branch_manager   tenant; scoped to ONE station
```

- **super_admin** — platform-level, no `organizationId`.
- **admin** — runs the **main station**; can sell at **any** station; can purchase, distribute, and set retail prices for **all stations or a specific one**. Not hard-scoped to one station (can pick any).
- **branch_manager** — assigned to one station; sells there; sets **only their own** station's retail price.

Tenant scoping (auto `organizationId` filter, `findUnique → findFirst` rewrite, raw-SQL manual filtering) is reused verbatim.

---

## 5. Domain Model

Prisma-style sketches (fields abbreviated; every tenant table also carries `organizationId` + relation).

### 5.1 `Station` (replaces `Store`; includes the depot)

```prisma
enum StationType {
  depot     // central; purchases land here; distributes to stations; NOT a selling point
  station   // selling location (main + branches)
}

model Station {
  id             String      @id @default(cuid())
  name           String
  address        String?
  type           StationType @default(station)
  isMain         Boolean     @default(false) // the admin's main station
  isActive       Boolean     @default(true)
  organizationId String
  // ... relations: users, inventory, sales, retailPrices, distributions ...
}
```

- One **depot** per organization (`type = depot`). Non-selling.
- One **main station** (`isMain = true`) operated by the admin; the rest are branch stations.

### 5.2 `Product` — per-product unit of measure

```prisma
enum UnitOfMeasure {
  liter
  unit
}

model Product {
  id             String        @id @default(cuid())
  name           String
  categoryId     Int
  unitOfMeasure  UnitOfMeasure @default(liter)
  isActive       Boolean       @default(true)
  organizationId String
  // NOTE: no price or cost here — price is per-station (§5.4), cost is per-location (§5.3)
}
```

Categories (petrol, diesel, gas, oil, …) reuse the inventory `Category` model (per-org).

### 5.3 `Inventory` — quantity **and** average cost **per location**

```prisma
model Inventory {
  id             String   @id @default(cuid())
  productId      String
  stationId      String   // any location: depot OR a station
  quantity       Decimal  @db.Decimal(14, 2) // liters/units, 2 dp
  averageCost    Decimal  @default(0) @db.Decimal(10, 2) // weighted-avg cost AT THIS location
  lowStockThreshold Decimal @default(0) @db.Decimal(14, 2)
  organizationId String

  @@unique([productId, stationId])
}
```

**Key change from inventory app:** `averageCost` moves from `Product` (org-level) to `Inventory` (**per location**). The depot has its own average cost; each station has its own.

### 5.4 `RetailPrice` — effective-dated daily price, per station

```prisma
model RetailPrice {
  id             String   @id @default(cuid())
  productId      String
  stationId      String
  price          Decimal  @db.Decimal(10, 2) // per liter/unit
  effectiveDate  DateTime @db.Date
  setById        String
  createdAt      DateTime @default(now())
  organizationId String

  @@index([productId, stationId, effectiveDate])
}
```

- The **current retail price** for a product at a station = the row with the latest `effectiveDate ≤ today`.
- **Admin "set for all stations"** = one `RetailPrice` row per station (same price + date). **Manager** = a row for their own station only.
- Full **daily history** preserved for trend reporting and "what was the price on day X".

### 5.5 `Purchase` — into the depot (reuses inventory purchasing + corrections)

```prisma
enum PurchaseType { purchase  correction }

model Purchase {
  id                 String       @id @default(cuid())
  productId          String
  quantity           Decimal      @db.Decimal(14, 2)
  unitPurchasePrice  Decimal      @db.Decimal(10, 2)
  totalCost          Decimal      @db.Decimal(14, 2)
  type               PurchaseType @default(purchase)
  correctsPurchaseId String?
  invoiceNumber      String?
  supplier           String?
  purchaseDate       DateTime     @db.Date
  purchasedById      String
  organizationId     String
}
```

- Lands in the **depot** `Inventory`; recomputes the **depot's** `averageCost` (moving weighted average).
- **Purchase corrections** carry over directly from the inventory work (`add`/`subtract` variants).

### 5.6 `Distribution` — depot → station, carries cost

```prisma
enum DistributionType { distribute  correction_add  correction_subtract }

model Distribution {
  id             String           @id @default(cuid())
  productId      String
  toStationId    String           // destination station
  quantity       Decimal          @db.Decimal(14, 2)
  unitCost       Decimal          @db.Decimal(10, 2) // depot avg cost carried at distribution time
  type           DistributionType @default(distribute)
  distributedById String
  note           String?
  createdAt      DateTime         @default(now())
  organizationId String
}
```

- Decrements **depot** quantity, increments **station** quantity.
- **Updates the receiving station's `averageCost`** — blends incoming liters (at the depot's current avg cost) into the station's existing stock. **This is the new twist** vs inventory (where distribution didn't touch cost).

### 5.7 `Sale` — retail or negotiated wholesale, at a station

```prisma
enum SaleType   { retail  wholesale }
enum SaleStatus { active  corrected }

model Sale {
  id             String     @id @default(cuid())
  stationId      String     // selling station (admin: any; manager: own)
  productId      String
  soldById       String
  saleType       SaleType   @default(retail)
  customerId     String?    // required for wholesale; optional for retail
  quantity       Decimal    @db.Decimal(14, 2) // liters/units
  listUnitPrice  Decimal    @db.Decimal(10, 2) // station retail price at sale time (the "list")
  unitPrice      Decimal    @db.Decimal(10, 2) // actually charged (= list for retail; negotiated for wholesale)
  unitCost       Decimal    @db.Decimal(10, 2) // station avg cost snapshot = COGS
  totalAmount    Decimal    @db.Decimal(14, 2) // unitPrice × quantity
  saleDate       DateTime   @db.Date
  status         SaleStatus @default(active)
  note           String?
  organizationId String
}
```

- **Retail:** `unitPrice = listUnitPrice` (current station price).
- **Wholesale:** seller enters a **negotiated** `unitPrice` (or a negotiated total → `unitPrice = total / quantity`); `listUnitPrice` retained so the **discount** = `(list − unitPrice)/list` and margin are visible.
- `unitCost` = the selling station's `averageCost` at sale time (COGS).
- **Below-cost guard:** if `unitPrice < unitCost`, warn + require confirm (reused).
- **Corrections** reuse the inventory `SaleCorrection` pattern.

### 5.8 Reused as-is (adapted names/decimals)

- `Customer` (retail/wholesale type) — for repeat wholesale buyers; negotiated fresh per sale.
- `SaleCorrection`, `Expense`, `ExpenseCategory`, `AuditLog`, `Organization`, `User`.

---

## 6. Core Mechanics

### 6.1 Per-location weighted-average cost

`averageCost` lives on each `Inventory` row (product @ location). The existing `computeWeightedAverageCost` / `reverseWeightedAverageCost` utils are reused unchanged (they already work on any quantity + cost) — now applied per location and with **decimal** quantities.

- **Purchase** → recompute **depot** average.
- **Distribution** → recompute **receiving station** average using the depot's current average as the incoming unit cost.
- **Sale / correction** → use / preserve the **station** average; never recomputed on sale.

### 6.2 Distribution carries cost (worked example)

- Depot: 1000 L @ avg cost 0.90.
- Distribute 500 L to Station A (which has 200 L @ 0.95):
  - Depot → 500 L (avg 0.90 unchanged).
  - Station A new avg = `(200×0.95 + 500×0.90) / 700 = 0.9143`.
  - Station A sales now cost at 0.9143.

### 6.3 Daily retail price

- Prices change daily; admin/manager add a `RetailPrice` row (per-station, effective-dated).
- A retail sale looks up the station's **current** price (latest `effectiveDate ≤ saleDate`) and snapshots it as `listUnitPrice`.
- Cost fluctuation on the buying side needs **no special handling** — weighted average absorbs it.

### 6.4 Wholesale negotiation

- Seller picks a wholesale customer, enters quantity, and a **negotiated** unit price or total.
- System shows the station's list price, the resulting **discount %**, and the **margin vs cost**; below-cost triggers the confirm guard.

---

## 7. Flows

| Flow | Endpoint (admin/manager as noted) | Effect |
|------|-----------------------------------|--------|
| Purchase | `POST /purchases` (admin) | Into depot; recompute depot avg cost |
| Purchase correction | `POST /purchases/:id/correct/{add,subtract}` (admin) | Reverse/adjust; recompute depot avg |
| Distribute | `POST /distributions` (admin) | Depot → station; recompute station avg cost |
| Set retail price | `POST /retail-prices` (admin: all/one station; manager: own) | New effective-dated price row(s) |
| Retail sale | `POST /sales` (admin any station, manager own) | Deduct station stock; COGS = station avg |
| Wholesale sale | `POST /sales` (`saleType=wholesale`, negotiated price, customer) | Same, negotiated price + discount |
| Sale correction | `PATCH /sales/:id/correct` | Adjust qty/total; restock; keep cost snapshot |

---

## 8. Reporting

- **Profit** per station / product / category = revenue − COGS (station avg cost).
- **Retail vs wholesale** breakdown; **discounts given** (list − charged).
- **Stock** per location (depot + each station); **purchases** and **stock investment**.
- **Price trends** from `RetailPrice` history (daily price chart).
- Per-station cost and margin. Expenses. All tenant-scoped; raw SQL manually filtered by `organizationId`.

---

## 9. Phased Build Plan

Because this forks the inventory codebase, most phases are **adapt-and-rename** rather than build-from-zero.

- **Phase 0 — Scaffold:** fork/clone the inventory repo; keep multi-tenancy, auth, tenant extension, expenses, audit, customers, reports skeleton.
- **Phase 1 — Locations & catalog:** `Store → Station` (+ `type`, `isMain`, depot); `Product.unitOfMeasure`; decimal `Inventory.quantity`; move `averageCost` onto `Inventory` (per location).
- **Phase 2 — Purchasing into depot:** purchases + corrections land in depot; per-location weighted average.
- **Phase 3 — Distribution carries cost:** depot → station; recompute station average on receipt.
- **Phase 4 — Retail price history:** `RetailPrice` (effective-dated, per station); admin bulk-set / manager own; current-price resolution.
- **Phase 5 — Sales:** retail + wholesale (negotiation, customer, list vs charged, below-cost guard); admin sells anywhere, managers at own; corrections.
- **Phase 6 — Reporting:** per-station cost/profit, retail vs wholesale, discounts, price trends, stock.
- **Phase 7 — Test & verify** end-to-end (like the inventory verification).

---

## 10. Open Decisions (Phase 0)

- [ ] **Decimal precision:** confirm `Decimal(14,2)` for quantities (liters to 2 dp) is enough, or need 3 dp for fuel.
- [ ] **One depot per org** (assumed) — or could an org have multiple depots later?
- [ ] **Admin station scope:** admin unassigned but can pick any station (assumed), with the main station as their default — confirm.
- [ ] **Wholesale requires a customer** (assumed) — or allow anonymous wholesale?
- [ ] **Retail sale without a set price:** block until a `RetailPrice` exists for that station+product (assumed).

## 11. Future Features (out of scope for v1)

- Tank capacity & level tracking (per station).
- Station-to-station transfers (beyond depot → station).
- Pump/POS hardware integration (v1 is manual entry).
- Shift/attendant tracking, meter readings.
- Per-customer statements / credit (wholesale on account).

---

## 12. Reuse Map (inventory → gas station)

| Inventory concept | Gas station | Change |
|-------------------|-------------|--------|
| `Store` | `Station` | add `type` (depot/station), `isMain` |
| Warehouse (`ensureOrgWarehouse`) | **Depot** | explicit location, `type=depot` |
| `Product.purchasePrice/averageCost` | — | `averageCost` moves to `Inventory` (per location); unit-of-measure added |
| `Inventory.quantity` (Int) | `Inventory.quantity` (Decimal) | decimal liters/units + per-location `averageCost` |
| `Purchase` + corrections | `Purchase` (into depot) | decimal qty; otherwise reused |
| `StockSupply` (distribute) | `Distribution` | now recomputes station cost |
| single `sellingPrice` on product | `RetailPrice` history | per-station, effective-dated |
| `Sale` (+ direct sale) | `Sale` | decimal qty; retail/wholesale; negotiated price; list vs charged |
| `Customer`, `SaleCorrection`, `Expense`, `AuditLog`, multi-tenancy | same | reused |
