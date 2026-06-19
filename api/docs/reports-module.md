# Reports Module — Design & API Reference

This document explains what the Reports module does, how metrics are calculated, how dates and money are handled, and how to use each endpoint. Use it when wiring the frontend, testing in Postman, or onboarding.

_Last updated: 2026-06-20_

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
12. [Product Distribution Response](#12-product-distribution-response)
13. [Filtering Rules](#13-filtering-rules)
14. [What Reports Does Not Do](#14-what-reports-does-not-do)
15. [Related Files](#15-related-files)
16. [Frontend Mapping](#16-frontend-mapping)
17. [Report Export (Excel & PDF)](#17-report-export-excel--pdf)

---

## 1. Overview

The **Reports module** is a **read-only analytics layer**. It:

- **Reads** data already stored by Sales, Expenses, Inventory, and Stock Supply
- **Aggregates** that data into KPIs, chart series, and table rows
- **Does not** create, update, or delete operational records (sales, products, etc.)
- **Does** write an audit log entry when a user downloads an Excel or PDF export

Think of it as the **accountant’s calculator** sitting on top of your operational data — not the place where sales or expenses are recorded.

### Who uses it

| Audience | Access |
|----------|--------|
| **Admin** | Company-wide dashboards, financial summary, stock report, optional store/category filters, exports |
| **Branch manager** | Own-store dashboard, store-scoped financial/stock exports (store forced from session) |

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
| `GET` | `/api/reports/financial-summary` | Admin, branch manager | Full P&L breakdown for a period |
| `GET` | `/api/reports/financial-summary/export` | Admin, branch manager | Download financial summary as Excel or PDF |
| `GET` | `/api/reports/product-distribution` | Admin | Units sold by product within one category (donut chart) |
| `GET` | `/api/reports/stock-report` | Admin, branch manager | Purchase, in-stock, and sales units by product |
| `GET` | `/api/reports/stock-report/export` | Admin, branch manager | Download stock report as Excel or PDF |

All endpoints require an authenticated session (Better Auth cookie). Unauthenticated or wrong-role requests are rejected by the global auth/roles guards.

### Example (Postman)

```
GET {{BASE_URL}}/api/reports/admin-dashboard?fromDate=2026-06-01&toDate=2026-06-07
Cookie: better-auth.session_token=...
```

---

## 4. Query Parameters

Used by **admin-dashboard**, **financial-summary**, and **stock-report** (`ReportQueryDto`):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromDate` | `YYYY-MM-DD` | No | Start of reporting period (inclusive) |
| `toDate` | `YYYY-MM-DD` | No | End of reporting period (inclusive) |
| `storeId` | string (cuid) | No | Limit to one store |
| `categoryId` | number | No | Limit to one product category (**admin-dashboard** and **stock-report**; on admin-dashboard limits sales only; on stock-report scopes purchases, in-stock, sales, and all totals) |

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

### Product distribution query (`ProductDistributionQueryDto`)

Used only by **`GET /api/reports/product-distribution`** — independent of admin dashboard filters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categoryId` | number | **Yes** | Product category to break down (Mobiles **or** Accessories — one at a time) |
| `fromDate` | `YYYY-MM-DD` | No | Start of period (inclusive) |
| `toDate` | `YYYY-MM-DD` | No | End of period (inclusive) |
| `storeId` | string (cuid) | No | Limit to one store; omit for all stores |

You must pick **one category** per request. The response lists **products** in that category with units sold and share of the category total.

Defaults for dates match the admin dashboard (last 6 months through today when omitted).

### Stock report query

Used by **`GET /api/reports/stock-report`** — same `ReportQueryDto` as admin dashboard and financial summary (`fromDate`, `toDate`, `storeId`, `categoryId`).

When `categoryId` is set, **purchase devices**, **in-stock**, **sales devices**, product rows, and all returned totals are scoped to active products in that category. Omit `categoryId` to include all products with any purchase, stock, or sales activity in the period.

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

Live metrics (`inStockBalance`, `lowStockCount`, `outOfStockCount`) have **no** comparison — they are point-in-time snapshots.

---

## 9. Admin Dashboard Response

**`GET /api/reports/admin-dashboard`**

### Top-level shape

```json
{
  "period": { "from", "to", "timezone" },
  "summary": { ... },
  "charts": { ... },
  "recentSales": [ ... ]
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
| `outOfStockCount` | Out of Stock |

### `charts`

| Key | Chart type | Description |
|-----|------------|-------------|
| `revenueCogsExpenses` | Grouped bar | Monthly revenue, COGS, expenses, net profit |
| `netProfitTrend` | Line | Monthly net profit |
| `expenseBreakdown` | Donut | Expenses by category for the period |
| `stockByCategory` | Donut | Current units in stock by category (live; respects dashboard `storeId` filter) |
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

### `stockByCategory` — live stock by category (admin dashboard)

Current inventory units grouped by category (not date-filtered):

```json
"stockByCategory": [
  { "categoryId": 1, "categoryName": "Mobiles", "units": 42 },
  { "categoryId": 2, "categoryName": "Accessories", "units": 12 }
]
```

- **All stores** when no `storeId`; **one store** when filtered  
- Only active products and active stores  

Frontend: optional second donut or reuse same component with different title.

### `recentSales`

Last 20 sales in the filtered period, with product, store, seller, and category included.

### Stock alert tables (not on dashboard payload)

Load paginated lists from the inventory module:

| UI table | Endpoint |
|----------|----------|
| Low stock | `GET /api/inventory/low-stock` |
| Out of stock | `GET /api/inventory/out-of-stock` |

Admin: optional `?storeId=` (omit for all stores). Manager: auto-scoped to assigned store. Both support `page`, `limit`, `search`, `categoryId`. Stat cards still use `summary.lowStockCount` and `summary.outOfStockCount`.

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
| `lowStockCount` | Low-stock items in their store now (`quantity > 0` and `<= threshold`) |
| `outOfStockCount` | Out-of-stock items in their store now (`quantity = 0`) |

### `charts`

| Key | Description |
|-----|-------------|
| `salesTrend` | Daily revenue for the last 30 calendar days |
| `stockByCategory` | Units in stock grouped by product category |

Also includes `recentSales` (last 20 for their store). Low/out-of-stock tables: `GET /api/inventory/low-stock` and `GET /api/inventory/out-of-stock`.

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

## 12. Product Distribution Response

**`GET /api/reports/product-distribution`** — admin only.

Dedicated endpoint for the **units sold by product** donut chart within **one category**. Requires `categoryId` — you never mix Mobiles and Accessories in a single response.

### Response shape

```json
{
  "period": {
    "from": "2026-06-01",
    "to": "2026-06-07",
    "timezone": "Africa/Mogadishu"
  },
  "filters": {
    "categoryId": 1,
    "categoryName": "Mobiles",
    "storeId": null
  },
  "totalUnitsSold": 7,
  "products": [
    {
      "productId": "clx...",
      "productName": "iPhone 15",
      "unitsSold": 4,
      "percent": 57.14
    },
    {
      "productId": "clx...",
      "productName": "Samsung Galaxy S24",
      "unitsSold": 3,
      "percent": 42.86
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `filters.categoryId` / `categoryName` | The category you filtered by |
| `totalUnitsSold` | Sum of units sold for products in that category (after date/store filters) |
| `products[].unitsSold` | Units sold for that product |
| `products[].percent` | That product’s share of `totalUnitsSold` within the selected category (0–100, 2 dp) |

- Filters by **`saleDate`** in the requested range  
- **`categoryId` is required** — returns 400 if missing/invalid; 404 if category does not exist  
- Optional **`storeId`** limits to one branch  

Frontend: donut chart for the selected category; center label = `totalUnitsSold`. User picks category via a dropdown/toggle (e.g. Mobiles vs Accessories).

### Example (Postman)

```
GET {{BASE_URL}}/api/reports/product-distribution?categoryId=1&fromDate=2026-06-01&toDate=2026-06-07
Cookie: better-auth.session_token=...
```

---

## 13. Filtering Rules

### Sales filters (admin)

Applied to all sale-based metrics in a request:

- **Date range** — `saleDate` between `fromDate` and `toDate` (inclusive)
- **`storeId`** — one store only
- **`categoryId`** — admin dashboard (sales metrics only) and stock report (purchases, in-stock, sales, and totals)

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
- `outOfStockCount`

---

## 14. What Reports Does Not Do

| Out of scope | Alternative |
|--------------|-------------|
| Create / edit / delete operational data | Use Sales, Expenses, Stock Supply modules |
| Store generated export files | Exports are generated on demand and streamed to the browser |
| Manager access to admin dashboard | Manager uses `/dashboard` (store-scoped) |
| Trend % badges on stat cards | Frontend can compute vs previous period later |

---

## 17. Report Export (Excel & PDF)

### Endpoints

| Method | Path | Format param |
|--------|------|----------------|
| `GET` | `/api/reports/financial-summary/export` | `format=xlsx` or `format=pdf` |
| `GET` | `/api/reports/stock-report/export` | `format=xlsx` or `format=pdf` |

Uses the same query parameters as the JSON report (`fromDate`, `toDate`, `storeId`, `categoryId` on stock) plus:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `format` | Yes | `xlsx` or `pdf` |
| `timezone` | No | IANA timezone for “Generated at” (browser sends user's local zone) |

### Access rules

- **Admin** — org-wide data; optional `storeId` / `categoryId` (stock) filters
- **Branch manager** — `storeId` is **forced** from the user's assigned store (query param ignored)

### Response

- `Content-Type`: Excel MIME or `application/pdf`
- `Content-Disposition: attachment; filename="financial-summary_YYYY-MM-DD_YYYY-MM-DD.xlsx"` (or `.pdf`)

### File contents

**Financial summary**

| Excel sheets | PDF sections |
|--------------|--------------|
| Summary, P&L, Monthly, Expenses | Summary, P&L, Monthly, Expenses by category (all landscape) |

Branded PDF header (org logo from R2 when configured) repeats on every page.

**Stock report**

| Excel sheets | PDF sections |
|--------------|--------------|
| Summary, By Product | Summary, By Product (all landscape) |

### Audit log

Each successful export creates:

- `action`: `REPORT_EXPORTED`
- `entityType`: `report`
- `entityId`: `financial-summary` or `stock-report`
- `newValue`: `{ report, format, fromDate, toDate, storeId, categoryId, timezone, filename }`

Visible in **Administration → Audit Log**.

### Implementation

```
api/src/modules/reports/export/
├── report-export.service.ts      # Orchestration
├── financial-export.builder.ts   # Excel + PDF layout
├── stock-export.builder.ts
├── excel-export.util.ts          # Shared Excel styling
├── pdf-export.util.ts            # Shared PDF header/footer
└── report-export-audit.util.ts   # Audit log write
```

Dependencies: **ExcelJS** (Excel), **pdfmake** (PDF, no Chromium required on VPS).

See also [image-upload.md](./image-upload.md) for organization logos embedded in PDF headers.

---

## 15. Related Files

| File | Role |
|------|------|
| `api/src/modules/reports/reports.controller.ts` | Route definitions |
| `api/src/modules/reports/reports.service.ts` | All aggregation queries |
| `api/src/modules/reports/export/` | Excel/PDF export builders and audit logging |
| `api/src/modules/reports/dto/product-distribution-query.dto.ts` | Product distribution filters |
| `api/src/common/utils/app-timezone.util.ts` | Calendar dates, timezone, report range |
| `api/src/common/utils/money.util.ts` | Decimal-safe money serialization |
| `api/src/common/utils/period-comparison.util.ts` | Period-over-period delta % |
| `api/docs/stock-supply-design.md` | How supply snapshots feed stock investment |
| `system-design.md` §7–8 | Original dashboard & report UI specs |
| `frontend-design-brief.md` §11 | Frontend card/chart mapping |

---

## 16. Frontend Mapping

### Admin dashboard (`/dashboard`)

| UI element | API source |
|------------|------------|
| Stat cards (9+) | `summary.*` (includes `outOfStockCount`) |
| Revenue vs COGS vs Expenses chart | `charts.revenueCogsExpenses` |
| Expense breakdown donut | `charts.expenseBreakdown` |
| Product distribution donut | **`GET /product-distribution`** — `products`, `totalUnitsSold`; **required** `categoryId` |
| Stock by category donut | `charts.stockByCategory` |
| Net profit trend line | `charts.netProfitTrend` |
| Top products bars | `charts.topProducts` |
| Top stores bars | `charts.topStores` |
| Recent sales table | `recentSales` |
| Low stock table | `GET /inventory/low-stock` |
| Out of stock table | `GET /inventory/out-of-stock` |
| Date / store filters | Query params `fromDate`, `toDate`, `storeId` |
| Product distribution filters | Separate call: **required** `categoryId`, optional `fromDate`, `toDate`, `storeId` |

### Financial summary (`/financial`)

| UI element | API source |
|------------|------------|
| Stat cards (5) | `summary.*` including `grossMarginPercent` |
| Stacked P&L bar | `breakdown` |
| Charts | `charts.revenueCogsExpenses`, `charts.netProfitTrend` |
| Expense list by category | `expenseByCategory` |
| Export menu | `GET /financial-summary/export?format=xlsx\|pdf` |

### Stock report (`/stock-report`)

| UI element | API source |
|------------|------------|
| Product table | `products`, `totals` |
| Filters | `fromDate`, `toDate`, `storeId`, `categoryId` |
| Export menu | `GET /stock-report/export?format=xlsx\|pdf` |

### Manager dashboard (`/dashboard`)

| UI element | API source |
|------------|------------|
| Today’s / month sales cards | `summary.todayRevenue`, `summary.monthRevenue` |
| In-stock / low-stock / out-of-stock cards | `summary.inStockBalance`, `summary.lowStockCount`, `summary.outOfStockCount` |
| Sales trend line | `charts.salesTrend` |
| Stock by category donut | `charts.stockByCategory` |
| Recent sales table | `recentSales` |
| Low / out-of-stock tables | `GET /inventory/low-stock`, `GET /inventory/out-of-stock` |
| Export menus | Financial + stock exports (last 6 months, store-scoped) |

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
Admin   = /admin-dashboard + /financial-summary + /stock-report + /product-distribution
Manager = /manager-dashboard + store-scoped exports
Export  = Excel (ExcelJS) + PDF (pdfmake), audit log REPORT_EXPORTED
Live    = stock value, balance, low-stock (not date-filtered)
```
