# Reports Module — Design & API Reference

This document explains what the Reports module does, how metrics are calculated, how dates and money are handled, and how to use each endpoint. Use it when wiring the frontend, testing in Postman, or onboarding.

_Last updated: 2026-06-07_

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Endpoints](#3-endpoints)
4. [Query Parameters](#4-query-parameters)
5. [Financial Metrics](#5-financial-metrics)
6. [Date & Timezone Rules](#6-date--timezone-rules)
7. [Money Precision](#7-money-precision)
8. [Period-over-Period Comparison](#8-period-over-period-comparison)
9. [Admin Dashboard Response](#9-admin-dashboard-response)
10. [Manager Dashboard Response](#10-manager-dashboard-response)
11. [Financial Summary Response](#11-financial-summary-response)
12. [Filtering Rules](#12-filtering-rules)
13. [What Reports Does Not Do](#13-what-reports-does-not-do)
14. [Related Files](#14-related-files)
15. [Frontend Mapping](#15-frontend-mapping)

---

## 1. Overview

The **Reports module** is a **read-only analytics layer**. It:

- **Reads** data already stored by Sales, Expenses, Inventory, and Stock Supply
- **Aggregates** that data into KPIs, chart series, and table rows
- **Does not** create, update, or delete any records
- **Does not** write audit logs

Think of it as the **accountant’s calculator** sitting on top of your operational data — not the place where sales or expenses are recorded.

### Who uses it

| Audience | Access |
|----------|--------|
| **Admin** | Company-wide dashboards, financial summary, optional store/category filters |
| **Branch manager** | Own-store mini-dashboard only (automatically scoped) |

---

## 2. Architecture

```
Sales ──────────┐
Expenses ───────┤
Inventory ──────┼──► Reports module ──► Admin UI (dashboard, financial page)
Stock Supply ───┤                  └──► Manager UI (store dashboard)
```

### Data sources

| Source table | Used for |
|--------------|----------|
| `sale` | Revenue, COGS, units sold, top products/stores, recent sales |
| `expense` | Total expenses, expense breakdown by category |
| `inventory` + `product` | Current stock value, in-stock balance, low-stock alerts |
| `stock_supply` | Stock investment (financial summary only) |

### Module location

```
api/src/modules/reports/
├── reports.controller.ts   # HTTP routes
├── reports.service.ts      # Aggregation logic
├── dto/report-query.dto.ts # Query validation
└── report-date.util.ts     # Re-exports from app-timezone util

api/src/common/utils/
├── app-timezone.util.ts    # Calendar dates, Mogadishu timezone
└── money.util.ts           # Decimal-safe money math
```

Registered in `app.module.ts` as `ReportsModule`. Global API prefix: `/api`.

---

## 3. Endpoints

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| `GET` | `/api/reports/admin-dashboard` | Admin | Company-wide dashboard data |
| `GET` | `/api/reports/manager-dashboard` | Branch manager | Store-scoped mini-dashboard |
| `GET` | `/api/reports/financial-summary` | Admin | Full P&L breakdown for a period |

All endpoints require an authenticated session (Better Auth cookie). Unauthenticated or wrong-role requests are rejected by the global auth/roles guards.

### Example (Postman)

```
GET {{BASE_URL}}/api/reports/admin-dashboard?fromDate=2026-06-01&toDate=2026-06-07
Cookie: better-auth.session_token=...
```

---

## 4. Query Parameters

Used by **admin-dashboard** and **financial-summary** (`ReportQueryDto`):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromDate` | `YYYY-MM-DD` | No | Start of reporting period (inclusive) |
| `toDate` | `YYYY-MM-DD` | No | End of reporting period (inclusive) |
| `storeId` | string (cuid) | No | Limit to one store |
| `categoryId` | number | No | Limit sales to one product category (**admin-dashboard only**) |

### Defaults when dates are omitted

- **`toDate`** → today in app timezone
- **`fromDate`** → start of the month, 6 months before `toDate`

Example: if today is `2026-06-07`, the default range is `2026-01-01` → `2026-06-07`.

### Validation errors

| Message | Cause |
|---------|-------|
| `Invalid date format, expected YYYY-MM-DD` | Malformed date string |
| `Invalid date` | Impossible date (e.g. `2026-02-30`) |
| `fromDate must be on or before toDate` | Start after end |

**Manager dashboard** accepts no query parameters — the store is taken from the logged-in user’s `storeId`.

---

## 5. Financial Metrics

All **period** metrics filter by **`saleDate`** and **`expenseDate`**, not `createdAt`.

| Metric | Formula | Notes |
|--------|---------|-------|
| **Total revenue** | `SUM(sale.totalAmount)` | Uses corrected sale totals after a correction |
| **Total units sold** | `SUM(sale.quantitySold)` | |
| **COGS** | `SUM(quantitySold × unitPurchasePrice)` | Snapshot on each sale row — not today’s catalog price |
| **Gross profit** | Revenue − COGS | |
| **Total expenses** | `SUM(expense.amount)` | |
| **Net profit** | Gross profit − total expenses | Can be negative (valid business state) |
| **Gross margin %** | `(grossProfit / revenue) × 100` | Financial summary only; `0` when revenue is `0` |
| **Current stock value** | `SUM(inventory.qty × product.purchasePrice)` | **Live snapshot** — not filtered by date range |
| **In-stock balance** | `SUM(inventory.quantity)` | **Live snapshot** |
| **Low stock count** | Rows where `quantity ≤ lowStockThreshold` | **Live snapshot** |
| **Stock investment** | `SUM(supply.qty × unitPurchasePrice)` in period | Financial summary only; uses `stock_supply.createdAt` |

### Worked example

Given sales revenue **6,299.93**, COGS **4,900**, expenses **1,501**:

```
Gross profit = 6,299.93 − 4,900.00 = 1,399.93
Net profit   = 1,399.93 − 1,501.00 = −101.07
```

Negative net profit means **operating expenses exceeded gross profit** for that period — not that revenue was negative.

---

## 6. Date & Timezone Rules

Business operations run in **Mogadishu** (`Africa/Mogadishu`, UTC+3, no daylight saving).

### Environment

```env
APP_TIMEZONE=Africa/Mogadishu
```

Must be a valid **IANA timezone name**. If invalid or missing, the API falls back to `Africa/Mogadishu`.

> **Do not use** shorthand like `Mogadishu` or `Somalia` — Luxon will reject them.

### What uses the timezone

| Use case | Behavior |
|----------|----------|
| **“Today”** (manager dashboard) | Calendar today in Mogadishu |
| **Default report range end** | Today in Mogadishu |
| **`fromDate` / `toDate` filters** | Calendar dates as entered (`YYYY-MM-DD`) |
| **`saleDate` / `expenseDate` columns** | Stored and compared as calendar dates |
| **`createdAt` filters** (stock investment, audit) | Start/end of local day converted to UTC instants |

### What stays UTC

`createdAt`, `updatedAt`, and audit log timestamps remain absolute UTC instants in the database. Timezone only affects how **calendar days** are interpreted for business reporting.

### Response `period` block

Every admin/financial response includes:

```json
"period": {
  "from": "2026-06-01",
  "to": "2026-06-07",
  "timezone": "Africa/Mogadishu"
}
```

Dates are **calendar strings**, not ISO timestamps — easier for the frontend to display.

---

## 7. Money Precision

Money is handled in three layers:

1. **Database** — `Decimal(10, 2)` (source of truth)
2. **Application** — Prisma `Decimal` math via `money.util.ts` (no JavaScript float arithmetic)
3. **API response** — rounded to **2 decimal places**, half-up

All SQL money aggregates use PostgreSQL `::numeric`, never `::float`.

This ensures API values match a calculator (e.g. `1399.93`, not `1399.9300000000003`).

---

## 8. Period-over-Period Comparison

Both dashboards include a **`comparison`** block for stat-card trend badges (e.g. **+12.4% vs last month**).

### How the previous period is chosen

The current range is shifted back **one calendar month** on both ends:

| Current period | Compared against |
|----------------|------------------|
| `2026-06-01` → `2026-06-07` | `2026-05-01` → `2026-05-07` |
| Jun 1–today (manager month MTD) | May 1–same day last month |

Formula:

```
delta % = ((current − previous) / previous) × 100
```

- Rounded to **2 decimal places** (same as money)
- **`direction`**: `up` \| `down` \| `flat`
- **`percent`**: `null` when previous value was `0` and current is &gt; 0 (frontend can show `N/A` or `+0.0%`)

### Admin dashboard `comparison`

Compared metrics (period-based only — not live stock):

| Field | Maps to stat card |
|-------|-------------------|
| `totalRevenue` | Total Revenue |
| `grossProfit` | Gross Profit |
| `netProfit` | Net Profit |
| `totalExpenses` | Total Expenses (up = bad; frontend may invert color) |
| `totalUnitsSold` | Units Sold |

Example:

```json
"comparison": {
  "label": "vs last month",
  "previousPeriod": { "from": "2026-05-01", "to": "2026-05-07" },
  "totalRevenue": { "percent": 12.4, "direction": "up", "label": "vs last month" },
  "netProfit": { "percent": -5.2, "direction": "down", "label": "vs last month" }
}
```

### Manager dashboard `comparison`

| Field | Current period | Previous period |
|-------|----------------|-----------------|
| `todayRevenue` | Today | Same calendar day last month |
| `monthRevenue` | 1st of month → today | Same day range last month |

Live metrics (`inStockBalance`, `lowStockCount`) have **no** comparison — they are point-in-time snapshots.

---

## 9. Admin Dashboard Response

**`GET /api/reports/admin-dashboard`**

### Top-level shape

```json
{
  "period": { "from", "to", "timezone" },
  "summary": { ... },
  "charts": { ... },
  "recentSales": [ ... ],
  "lowStock": [ ... ]
}
```

### `summary` — stat cards

| Field | UI label (typical) |
|-------|--------------------|
| `totalRevenue` | Total Revenue |
| `totalUnitsSold` | Units Sold |
| `cogs` | Cost of Goods Sold |
| `grossProfit` | Gross Profit |
| `totalExpenses` | Total Expenses |
| `netProfit` | Net Profit |
| `currentStockValue` | Current Stock Value |
| `inStockBalance` | In-Stock Balance |
| `lowStockCount` | Low Stock Alerts |

### `charts`

| Key | Chart type | Description |
|-----|------------|-------------|
| `revenueCogsExpenses` | Grouped bar | Monthly revenue, COGS, expenses, net profit |
| `netProfitTrend` | Line | Monthly net profit |
| `expenseBreakdown` | Donut | Expenses by category for the period |
| `topProducts` | Horizontal bar | Top 10 products by units sold |
| `topStores` | Horizontal bar | Top 10 stores by revenue (empty when `storeId` filter is set) |

Each monthly chart row:

```json
{
  "month": "Jun",
  "monthKey": "2026-06",
  "revenue": 6299.93,
  "cogs": 4900,
  "expenses": 1501,
  "netProfit": -101.07
}
```

### `recentSales`

Last 20 sales in the filtered period, with product, store, seller, and category included.

### `lowStock`

Up to 50 inventory rows where `quantity ≤ lowStockThreshold`, across active products and stores (or one store if filtered).

---

## 10. Manager Dashboard Response

**`GET /api/reports/manager-dashboard`**

Automatically scoped to the manager’s assigned `storeId`. No query params.

### `summary`

| Field | Description |
|-------|-------------|
| `todayRevenue` | Revenue for **today** (Mogadishu calendar) |
| `todayUnitsSold` | Units sold today |
| `monthRevenue` | Revenue from **1st of current month** through today |
| `inStockBalance` | Total units in their store now |
| `lowStockCount` | Low-stock items in their store now |

### `charts`

| Key | Description |
|-----|-------------|
| `salesTrend` | Daily revenue for the last 30 calendar days |
| `stockByCategory` | Units in stock grouped by product category |

Also includes `recentSales` (last 20 for their store) and `lowStock` for their store.

---

## 11. Financial Summary Response

**`GET /api/reports/financial-summary`**

Dedicated P&L page data for admins. Same date/store filters as admin dashboard (no `categoryId`).

### Extra fields vs admin dashboard

| Field | Description |
|-------|-------------|
| `summary.grossMarginPercent` | `(grossProfit / revenue) × 100` |
| `summary.stockInvestment` | Capital invested via stock supplies in the period |
| `expenseByCategory` | Same data as chart expense breakdown, as a flat list |
| `breakdown` | Stacked formula values for the visual P&L bar |

### `breakdown` — the financial formula

```json
"breakdown": {
  "revenue": 6299.93,
  "cogs": 4900,
  "grossProfit": 1399.93,
  "expenses": 1501,
  "netProfit": -101.07
}
```

Frontend renders this as:

```
Revenue          →  COGS  →  Gross Profit  →  Expenses  →  Net Profit
```

### Charts

Only `revenueCogsExpenses` and `netProfitTrend` (no top products/stores, no expense donut duplicate beyond `expenseByCategory`).

---

## 12. Filtering Rules

### Sales filters (admin)

Applied to all sale-based metrics in a request:

- **Date range** — `saleDate` between `fromDate` and `toDate` (inclusive)
- **`storeId`** — one store only
- **`categoryId`** — admin dashboard only; limits sales to products in that category

### Expense filters

- **Date range** — `expenseDate` between `fromDate` and `toDate` (inclusive)
- **`storeId`** — see scoping rules below

### Expense scoping by store

| View | Expenses included |
|------|-------------------|
| **All stores** (no `storeId`) | Store-specific **and** company-wide (`storeId = null`) |
| **One store** (`storeId` set) | Only expenses linked to that store |

Company-wide expenses (rent, salaries, etc.) appear in company totals but are excluded from a single-store P&L so store numbers stay meaningful.

### Live metrics ignore date range

These always reflect **current** state:

- `currentStockValue`
- `inStockBalance`
- `lowStockCount`
- `lowStock` list

---

## 13. What Reports Does Not Do

| Out of scope (v1) | Alternative |
|-------------------|-------------|
| Create / edit / delete data | Use Sales, Expenses, Stock Supply modules |
| PDF / Excel export | Future frontend or dedicated export endpoint |
| Tabular “Sales Report”, “Stock Report”, “Profit Report” pages | Use existing list endpoints (`GET /sales`, `GET /inventory`, etc.) or future report endpoints |
| Audit log writes | Reports is read-only |
| Manager access to financial summary | Admin only by design |
| Trend % badges on stat cards | Frontend can compute vs previous period later |

---

## 14. Related Files

| File | Role |
|------|------|
| `api/src/modules/reports/reports.controller.ts` | Route definitions |
| `api/src/modules/reports/reports.service.ts` | All aggregation queries |
| `api/src/common/utils/app-timezone.util.ts` | Calendar dates, timezone, report range |
| `api/src/common/utils/money.util.ts` | Decimal-safe money serialization |
| `api/src/common/utils/period-comparison.util.ts` | Period-over-period delta % |
| `api/docs/stock-supply-design.md` | How supply snapshots feed stock investment |
| `system-design.md` §7–8 | Original dashboard & report UI specs |
| `frontend-design-brief.md` §11 | Frontend card/chart mapping |

---

## 15. Frontend Mapping

### Admin dashboard (`/dashboard`)

| UI element | API source |
|------------|------------|
| Stat cards (8) | `summary.*` |
| Revenue vs COGS vs Expenses chart | `charts.revenueCogsExpenses` |
| Expense breakdown donut | `charts.expenseBreakdown` |
| Net profit trend line | `charts.netProfitTrend` |
| Top products bars | `charts.topProducts` |
| Top stores bars | `charts.topStores` |
| Recent sales table | `recentSales` |
| Low stock table | `lowStock` |
| Date / store filters | Query params `fromDate`, `toDate`, `storeId` |

### Financial summary (`/financial`)

| UI element | API source |
|------------|------------|
| Stat cards (5) | `summary.*` including `grossMarginPercent` |
| Stacked P&L bar | `breakdown` |
| Charts | `charts.revenueCogsExpenses`, `charts.netProfitTrend` |
| Expense list by category | `expenseByCategory` |

### Manager dashboard (`/dashboard`)

| UI element | API source |
|------------|------------|
| Today’s / month sales cards | `summary.todayRevenue`, `summary.monthRevenue` |
| In-stock / low-stock cards | `summary.inStockBalance`, `summary.lowStockCount` |
| Sales trend line | `charts.salesTrend` |
| Stock by category donut | `charts.stockByCategory` |
| Recent sales / stock tables | `recentSales`, `lowStock` |

### UX notes

- Show **net profit in red/rose** when negative — that is valid data, not an error.
- Prefer a **non-blocking banner** (“Expenses exceeded gross profit by X”) over a modal popup on every load.
- Format money with 2 decimal places; values from the API are already rounded.

---

## Quick reference card

```
Reports = read-only analytics
Dates   = saleDate / expenseDate (calendar, Mogadishu)
Money   = Decimal in DB → 2 dp in JSON
Admin   = /admin-dashboard + /financial-summary
Manager = /manager-dashboard (own store only)
Live    = stock value, balance, low-stock (not date-filtered)
```
