# Multi-Location Inventory Management System

## System Design Document

**Version:** 1.2  
**Date:** 2026-06-03  
**Status:** Draft

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [System Features & Requirements](#3-system-features--requirements)
4. [User Stories](#4-user-stories)
5. [Business Rules](#5-business-rules)
6. [Database Models](#6-database-models)
7. [Dashboard Specifications](#7-dashboard-specifications)
8. [Reports](#8-reports)
9. [Audit & Corrections](#9-audit--corrections)
10. [Authentication & Security](#10-authentication--security)
11. [Expense Management](#11-expense-management)

---

**Budget:** $500

---

## 1. System Overview

A web-based inventory management system that allows a central supplier (Admin) to manage products across multiple store locations. Branch managers at each store record daily sales through a simple form. The Admin monitors stock levels, sales performance, and profit across all stores through a central dashboard.

### Key Concepts

- **Products** exist in a global catalog and are distributed to one or more stores with specific quantities.
- **Stock** is tracked per-store, not globally. The same product can have different quantities at different locations.
- **Sales** are recorded by branch managers and automatically deduct from that store's stock.
- **Supply events** are recorded each time Admin sends stock to a store, building a full supply history.

---

## 2. User Roles & Permissions

### 2.1 Admin (Supplier)

- Full system access
- Can create, edit, and deactivate any user (admin or branch manager)
- Can create and manage products
- Can supply/restock products to any store
- Can view all stores, all sales, and all reports
- Can view and export all reports
- Multiple admins are supported with equal permissions

### 2.2 Branch Manager

- Scoped to their assigned store only
- Can view their own store's current stock levels
- Can submit sales forms (product sold + quantity)
- Can correct a previously submitted sale (within policy)
- Can view their own store's sales history
- Cannot access other stores' data
- Cannot manage users or products

### 2.3 Permission Matrix

| Action                      | Admin | Branch Manager |
| --------------------------- | ----- | -------------- |
| Create / manage users       | Yes   | No             |
| Create / manage products    | Yes   | No             |
| Supply stock to stores      | Yes   | No             |
| Submit sales form           | No    | Yes            |
| Correct own sale submission | No    | Yes            |
| View own store dashboard    | Yes   | Yes            |
| View all stores dashboard   | Yes   | No             |
| Generate / export reports   | Yes   | No             |
| Add / manage expenses       | Yes   | No             |
| View financial summary      | Yes   | No             |

---

## 3. System Features & Requirements

### 3.1 Product Management

- Admin creates products with: name, category, purchase price, selling price, and description.
- Products belong to one of two categories: **Mobiles** or **Accessories**.
- A product can be assigned to multiple stores with independent quantities per store.
- Admin can edit product details (price changes do not affect historical sales records).
- Admin can deactivate a product (soft delete — preserves history).

### 3.2 Store / Location Management

- Admin creates and manages store locations.
- Each store has a name, address, and contact details.
- A store can have multiple branch managers assigned to it.

### 3.3 Stock Supply

- Admin supplies products to stores by recording a supply event: product, store, quantity added, and optional notes.
- Each supply event is logged with timestamp and the admin who performed it.
- Supplying stock increases the store's inventory quantity.

### 3.4 Sales Recording

- Branch managers submit a sales form per transaction: product, quantity sold, and optional notes.
- The system auto-fills: store (from manager's account), date/time, and the manager's identity.
- On submission, the store's inventory for that product decreases by the sold quantity.
- The selling price at the time of the sale is captured as a snapshot (so future price changes don't alter historical records).
- The system prevents submitting a sale quantity greater than current stock.

### 3.5 Sale Corrections

- A branch manager can correct a previously submitted sale.
- Correction captures: original quantity, corrected quantity, and a mandatory reason.
- The inventory is adjusted automatically (difference is added back or deducted).
- All corrections are logged in audit history.

### 3.6 User Management

- Admin can create users of any role (admin or branch manager).
- Admin can assign a branch manager to a specific store.
- Admin can deactivate a user account (soft delete).
- Each user has: name, email, password, role, and assigned store (for managers).

### 3.8 Expense Management
- Admin can record operational expenses (electricity, rent, salaries, etc.) with a title, amount, category, store, and date.
- Expenses can be assigned to a specific store or marked as company-wide.
- Admin can edit or delete any expense.
- Stock investment is automatically calculated from supply history — no manual entry required.
- A financial summary page displays revenue, COGS, gross profit, expenses, and net profit — all filterable by date range and store.
- Financial reports are exportable as PDF or Excel.

### 3.7 Low Stock Alerts

- Each product-store combination has a configurable low stock threshold.
- When quantity falls at or below the threshold, a warning is shown in the admin dashboard.
- Default threshold is 5 units unless overridden.

---

## 4. User Stories

### Admin Stories

| ID   | Story                                                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | As an admin, I want to create a product with name, category, purchase price, and selling price so that it can be tracked in the system. |
| A-02 | As an admin, I want to supply a product to a specific store with a quantity so that the store's stock is updated.                       |
| A-03 | As an admin, I want to create user accounts for other admins and branch managers so that they can access the system.                    |
| A-04 | As an admin, I want to see a dashboard with total sales, stock levels, and charts so that I can monitor performance across all stores.  |
| A-05 | As an admin, I want to see low stock warnings so that I can resupply stores before they run out.                                        |
| A-06 | As an admin, I want to generate reports by store, product, category, or date range so that I can analyze business performance.          |
| A-07 | As an admin, I want to export reports to PDF or Excel so that I can share them externally.                                              |
| A-08 | As an admin, I want to view the full audit log so that I can track all stock and sales changes.                                         |
| A-09 | As an admin, I want to add and manage expenses so that operational costs are recorded alongside revenue.                                |
| A-10 | As an admin, I want to view a financial summary showing revenue, costs, expenses, and net profit so that I have a complete business overview. |

### Branch Manager Stories

| ID   | Story                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | As a branch manager, I want to submit a sales form with product and quantity sold so that the system records the sale and deducts from stock. |
| B-02 | As a branch manager, I want to view my store's current stock so that I know what's available.                                                 |
| B-03 | As a branch manager, I want to correct a sales entry I submitted so that incorrect records can be fixed.                                      |
| B-04 | As a branch manager, I want to view my store's sales history so that I can review past submissions.                                           |
| B-05 | As a branch manager, I want to see my store's mini-dashboard so that I have an overview of my store's performance.                            |

---

## 5. Business Rules

1. **Stock cannot go negative.** A sale submission is rejected if the quantity sold exceeds available stock. This is enforced at two levels: application logic (check before deducting) and a database `CHECK (quantity >= 0)` constraint on `inventory.quantity`. Stock deduction must run inside a database transaction with row-level locking on the inventory record to prevent race conditions when multiple managers submit sales simultaneously.
2. **Price snapshot on sale.** Both the selling price and purchase price at the time of sale are stored permanently in `sales.unit_price` and `sales.unit_purchase_price`. Changing product prices later does not alter any historical sale or profit record.
3. **Store-scoped access.** A branch manager can only view and submit data for their assigned store.
4. **Corrections are audited.** Every correction records the original value, new value, reason, and who made the change. Only the quantity field can be corrected — if the wrong product was selected, the original sale must be corrected to zero and a new sale submitted.
5. **Soft deletes only.** Products and users are never permanently deleted — they are deactivated. This preserves all historical data.
6. **Supply events are immutable.** Once a supply is recorded, it cannot be deleted. If a mistake is made, a corrective supply with a negative or adjusted quantity and a mandatory note is recorded (see Section 9 for the corrective supply flow).
7. **One store per manager.** A branch manager is assigned to one store, but a store can have multiple branch managers. If a manager is reassigned to a different store, all their historical sales remain linked to the original store via `sales.store_id`, which is captured at submission time and never updated.
8. **Multiple admins.** Admin accounts all have equal permissions.
9. **Product must exist at store before sale.** A sale can only be submitted for a product that has an active inventory record at the manager's store. If no inventory record exists for that product-store combination, the product does not appear in the sales form.
10. **Sale date bounds.** A manager can submit a sale dated no earlier than 7 days in the past and no later than today. Future-dated sales are not permitted.
11. **First admin account.** The very first admin account is created through a one-time system seed/bootstrap script run during deployment. All subsequent users are created by admins through the application.

---

## 6. Database Models

### 6.1 `users`

| Column     | Type         | Description                                                                         |
| ---------- | ------------ | ----------------------------------------------------------------------------------- |
| id         | UUID / INT   | Primary key                                                                         |
| name       | VARCHAR(100) | Full name                                                                           |
| email      | VARCHAR(150) | Unique, used for login                                                              |
| password   | VARCHAR(255) | Hashed password                                                                     |
| role       | ENUM         | `admin` or `branch_manager`                                                         |
| store_id   | FK → stores  | Null for admins; required for branch managers (multiple managers can share a store) |
| is_active  | BOOLEAN      | Soft delete flag (default true)                                                     |
| created_by | FK → users   | Admin who created this user                                                         |
| created_at | TIMESTAMP    | Auto-set on creation                                                                |
| updated_at | TIMESTAMP    | Auto-updated on change                                                              |

---

### 6.2 `stores`

| Column     | Type         | Description         |
| ---------- | ------------ | ------------------- |
| id         | UUID / INT   | Primary key         |
| name       | VARCHAR(100) | Store / branch name |
| address    | TEXT         | Physical address    |
| phone      | VARCHAR(20)  | Contact number      |
| is_active  | BOOLEAN      | Soft delete flag    |
| created_at | TIMESTAMP    |                     |
| updated_at | TIMESTAMP    |                     |

---

### 6.3 `categories`

| Column      | Type        | Description                |
| ----------- | ----------- | -------------------------- |
| id          | INT         | Primary key                |
| name        | VARCHAR(50) | `Mobiles` or `Accessories` |
| description | TEXT        | Optional description       |
| created_at  | TIMESTAMP   |                            |
| updated_at  | TIMESTAMP   |                            |

> Seeded with two fixed records: **Mobiles** and **Accessories**.

---

### 6.4 `products`

| Column         | Type            | Description                               |
| -------------- | --------------- | ----------------------------------------- |
| id             | UUID / INT      | Primary key                               |
| name           | VARCHAR(150)    | Product name                              |
| category_id    | FK → categories | Mobiles or Accessories                    |
| description    | TEXT            | Optional                                  |
| purchase_price | DECIMAL(10,2)   | Cost price (used for profit calculations) |
| selling_price  | DECIMAL(10,2)   | Retail price                              |
| image_url      | VARCHAR(255)    | Optional product image                    |
| is_active      | BOOLEAN         | Soft delete flag                          |
| created_by     | FK → users      | Admin who created the product             |
| created_at     | TIMESTAMP       |                                           |
| updated_at     | TIMESTAMP       |                                           |

---

### 6.5 `inventory`

Tracks stock levels per product per store.

| Column              | Type          | Description                                         |
| ------------------- | ------------- | --------------------------------------------------- |
| id                  | UUID / INT    | Primary key                                         |
| product_id          | FK → products | The product                                         |
| store_id            | FK → stores   | The store                                           |
| quantity            | INT           | Current stock level (cannot go below 0)             |
| low_stock_threshold | INT           | Alert when quantity reaches this level (default: 5) |
| created_at          | TIMESTAMP     |                                                     |
| updated_at          | TIMESTAMP     |                                                     |

> **Unique constraint** on `(product_id, store_id)` — one record per product per store.

---

### 6.6 `sales`

| Column              | Type          | Description                                                   |
| ------------------- | ------------- | ------------------------------------------------------------- |
| id                  | UUID / INT    | Primary key                                                   |
| product_id          | FK → products | Product sold                                                  |
| store_id            | FK → stores   | Store where sale happened                                     |
| sold_by             | FK → users    | Branch manager who submitted the sale                         |
| quantity_sold       | INT           | Number of units sold                                          |
| unit_price          | DECIMAL(10,2) | Selling price snapshot at time of sale                        |
| unit_purchase_price | DECIMAL(10,2) | Purchase price snapshot at time of sale (for profit accuracy) |
| total_amount        | DECIMAL(10,2) | `quantity_sold × unit_price` (computed and stored)            |
| sale_date           | DATE          | Date of sale (can differ from submission date)                |
| note                | TEXT          | Optional manager note                                         |
| status              | ENUM          | `active` or `corrected`                                       |
| created_at          | TIMESTAMP     | Submission timestamp                                          |
| updated_at          | TIMESTAMP     |                                                               |

---

### 6.7 `sale_corrections`

| Column             | Type       | Description                          |
| ------------------ | ---------- | ------------------------------------ |
| id                 | UUID / INT | Primary key                          |
| sale_id            | FK → sales | The sale being corrected             |
| original_quantity  | INT        | Quantity before correction           |
| corrected_quantity | INT        | Quantity after correction            |
| reason             | TEXT       | Mandatory reason for the correction  |
| corrected_by       | FK → users | Manager who submitted the correction |
| created_at         | TIMESTAMP  |                                      |

> **Limitation:** corrections only support changing the quantity. If the wrong product was selected on the original sale, the manager must correct the original sale quantity to zero and submit a new sale for the correct product.

---

### 6.8 `stock_supplies`

Records every time an admin sends stock to a store.

| Column      | Type          | Description                                 |
| ----------- | ------------- | ------------------------------------------- |
| id                  | UUID / INT    | Primary key                                                              |
| product_id          | FK → products | Product being supplied                                                   |
| store_id            | FK → stores   | Destination store                                                        |
| quantity            | INT           | Units added to store inventory                                           |
| unit_purchase_price | DECIMAL(10,2) | Purchase price snapshot at time of supply (for stock investment accuracy)|
| supplied_by         | FK → users    | Admin who performed the supply                                           |
| note                | TEXT          | Optional note (e.g., "Monthly restock")                                  |
| created_at          | TIMESTAMP     | Immutable — supply records are never edited                              |

---

### 6.9 `audit_logs`

Captures all significant system events automatically.

| Column      | Type        | Description                                              |
| ----------- | ----------- | -------------------------------------------------------- |
| id          | UUID / INT  | Primary key                                              |
| user_id     | FK → users  | Who performed the action                                 |
| action      | VARCHAR(50) | e.g., `SALE_CREATED`, `STOCK_SUPPLIED`, `SALE_CORRECTED` |
| entity_type | VARCHAR(50) | e.g., `sale`, `inventory`, `product`                     |
| entity_id   | VARCHAR(50) | ID of the affected record                                |
| old_value   | JSON        | State before the change (nullable)                       |
| new_value   | JSON        | State after the change (nullable)                        |
| created_at  | TIMESTAMP   |                                                          |

---

### 6.10 `expense_categories`

| Column      | Type        | Description                                                          |
| ----------- | ----------- | -------------------------------------------------------------------- |
| id          | INT         | Primary key                                                          |
| name        | VARCHAR(50) | Category name (e.g., Utilities, Rent, Salaries)                      |
| description | TEXT        | Optional description                                                 |
| created_at  | TIMESTAMP   |                                                                      |
| updated_at  | TIMESTAMP   |                                                                      |

> Seeded with: **Utilities**, **Rent**, **Salaries**, **Maintenance**, **Transport**, **Marketing**, **Other**.

---

### 6.11 `expenses`

| Column      | Type                    | Description                                                                 |
| ----------- | ----------------------- | --------------------------------------------------------------------------- |
| id          | UUID / INT              | Primary key                                                                 |
| title       | VARCHAR(150)            | Short description of the expense (e.g., "June Electricity Bill")            |
| amount      | DECIMAL(10,2)           | Expense amount — must be positive                                           |
| category_id | FK → expense_categories | The expense category                                                        |
| store_id    | FK → stores (nullable)  | The store this expense belongs to. Null means company-wide expense          |
| expense_date| DATE                    | Date the expense occurred — cannot be a future date                         |
| receipt_url | VARCHAR(255)            | Optional URL to an uploaded receipt image or file                           |
| note        | TEXT                    | Optional additional notes                                                   |
| created_by  | FK → users              | Admin who recorded the expense                                              |
| created_at  | TIMESTAMP               |                                                                             |
| updated_at  | TIMESTAMP               |                                                                             |

---

### 6.12 Entity Relationship Summary

```
users ──< sales >── products ──< inventory >── stores
                                                  ^
users ──< stock_supplies >─────────────────────────┘
sales ──< sale_corrections
users ──< audit_logs
users ──< expenses >── expense_categories
expenses >── stores (nullable — null = company-wide)
products >── categories
users >──< stores (multiple managers can be assigned to one store)
```

---

## 7. Dashboard Specifications

### 7.1 Admin Dashboard

#### Summary Cards (top row)

| Card                  | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| Total Revenue         | SUM(`sales.total_amount`) for selected period                              |
| Total Units Sold      | SUM(`sales.quantity_sold`) for selected period                             |
| Gross Profit          | Revenue − COGS (`quantity_sold × unit_purchase_price`) for selected period |
| Total Expenses        | SUM(`expenses.amount`) for selected period                                 |
| Net Profit            | Gross Profit − Total Expenses for selected period                          |
| Current Stock Value   | SUM(`inventory.quantity × products.purchase_price`) — live, all stores    |
| In-Stock Balance      | Total units across all stores and all products                             |
| Low Stock Alerts      | Count of inventory records at or below threshold                           |

#### Charts

| Chart                        | Type        | Description                                                       |
| ---------------------------- | ----------- | ----------------------------------------------------------------- |
| Sales Trend                  | Line chart  | Daily / weekly / monthly revenue over time                        |
| Revenue vs COGS vs Expenses  | Grouped bar | Side-by-side monthly comparison of revenue, cost, and expenses    |
| Net Profit Trend             | Line chart  | Monthly net profit after expenses                                 |
| Expense Breakdown            | Pie/Donut   | Expenses split by category for selected period                    |
| Product Distribution         | Pie/Donut   | Units sold split by category (Mobiles vs Accessories)             |
| Stock Distribution by Store  | Bar chart   | Current stock levels per store                                    |
| Top Selling Products         | Bar chart   | Top 5–10 products by units sold                                   |
| Top Performing Stores        | Bar chart   | Revenue by store                                                  |

#### Tables

- **Recent Sales** — last 20 sales across all stores (product, store, manager, qty, amount, date)
- **Low Stock Warnings** — products at or below threshold with store name and current quantity
- **Recent Activity Feed** — latest supply events and sale submissions

#### Filters

- Date range picker (today / this week / this month / custom)
- Store selector (all stores or specific store)
- Category selector (all / Mobiles / Accessories)

---

### 7.2 Branch Manager Dashboard

#### Summary Cards

| Card             | Value                                   |
| ---------------- | --------------------------------------- |
| Today's Sales    | Units sold and revenue for today        |
| This Month Sales | Revenue for current month               |
| In-Stock Balance | Total units available in their store    |
| Low Stock Items  | Products below threshold in their store |

#### Charts

- Sales trend for their store (line chart)
- Their store's stock distribution by category (pie chart)

#### Tables

- Their recent sales history (last 20 submissions)
- Their store's current stock levels (product name, category, quantity, threshold status)

---

## 8. Reports

All reports are accessible to Admin only and can be exported as **PDF** or **Excel**.

### 8.1 Sales Report

- Filters: store, product, category, date range
- Columns: date, store, product, category, quantity sold, unit price, total amount, sold by
- Totals: total units, total revenue

### 8.2 Stock Report (Current Inventory)

- Filters: store, category, low stock only
- Columns: product, category, store, current quantity, threshold, status (OK / Low)

### 8.3 Profit Report

- Filters: store, category, date range
- Columns: product, category, units sold, purchase price (at sale time), selling price (at sale time), profit per unit, total profit
- Totals: total cost, total revenue, total profit, profit margin %

### 8.4 Supply History Report

- Filters: store, product, admin, date range
- Columns: date, product, store, quantity supplied, supplied by, note

### 8.5 Audit Log Report

- Filters: user, action type, date range
- Columns: timestamp, user, action, entity type, entity ID, change summary

### 8.6 Financial Overview Report

- Filters: store (all or specific), date range
- Sections:
  - **Revenue Summary:** total revenue, total units sold, COGS, gross profit, gross margin %
  - **Expense Summary:** total expenses broken down by category
  - **Net Position:** gross profit − total expenses = net profit
  - **Stock Investment:** total capital invested in stock supplies for the period (from `stock_supplies.quantity × unit_purchase_price`)
  - **Current Stock Value:** live value of remaining inventory
- Totals: one consolidated net profit figure at the bottom
- Exportable as PDF or Excel

---

## 9. Audit & Corrections

### Sale Correction Flow

1. Branch manager navigates to their sales history.
2. Selects a sale entry and clicks "Correct".
3. Enters the corrected quantity and a mandatory reason.
4. System calculates the difference and adjusts inventory:
   - If corrected qty < original qty → stock is added back.
   - If corrected qty > original qty → stock is further deducted (only if stock allows).
5. Original sale record is marked as `corrected`.
6. A `sale_corrections` record is created.
7. An `audit_log` entry is written.

### Corrective Supply Flow

Supply records are immutable and cannot be deleted. If an admin makes a mistake on a supply (wrong product, wrong store, or wrong quantity), the following process applies:

1. Admin identifies the incorrect supply record.
2. Admin creates a new supply record for the same product and store with the correction details and a mandatory note explaining the reason (e.g., "Corrects supply #42 — wrong quantity entered, actual was 10 not 100").
3. If the original supply overstated quantity: a new supply with a **negative quantity** is recorded to bring the inventory back down.
4. If the original supply understated quantity: a new supply with the missing quantity is recorded to add the remainder.
5. The inventory quantity is adjusted automatically by the new supply record.
6. An `audit_log` entry is written for the corrective supply.

> Note: negative-quantity supplies are only permitted for admins performing explicit corrections. The system should flag them in the supply history report with a "Correction" label.

---

### Audit Log Events

| Event               | Trigger                                |
| ------------------- | -------------------------------------- |
| `USER_CREATED`      | Admin creates a user                   |
| `PRODUCT_CREATED`   | Admin creates a product                |
| `STOCK_SUPPLIED`    | Admin supplies stock to a store        |
| `SALE_CREATED`      | Manager submits a sale form            |
| `SALE_CORRECTED`    | Manager corrects a sale                |
| `INVENTORY_UPDATED` | Any change to a store's stock quantity |
| `USER_DEACTIVATED`  | Admin deactivates a user account       |
| `PRODUCT_UPDATED`   | Admin edits a product's details        |
| `EXPENSE_CREATED`   | Admin adds a new expense               |
| `EXPENSE_UPDATED`   | Admin edits an existing expense        |
| `EXPENSE_DELETED`   | Admin deletes an expense               |

---

## 10. Authentication & Security

### 10.1 Login Flow

1. User submits email and password.
2. System looks up the user by email. If not found or `is_active = false`, return a generic error (do not reveal which is wrong).
3. System verifies the submitted password against the stored hash using **bcrypt**.
4. On success, issue a signed **JWT access token** (expires in 15 minutes) and a **refresh token** (expires in 7 days), stored in an HTTP-only cookie.
5. On failure, return 401. After 5 consecutive failed attempts, lock the account for 15 minutes.

### 10.2 Token Management

| Token         | Expiry | Storage          | Purpose                            |
| ------------- | ------ | ---------------- | ---------------------------------- |
| Access token  | 15 min | HTTP-only cookie | Authenticate API requests          |
| Refresh token | 7 days | HTTP-only cookie | Obtain a new access token silently |

- The access token payload includes: `user_id`, `role`, `store_id`.
- All protected API routes validate the access token on every request.
- When the access token expires, the client uses the refresh token to get a new one without requiring re-login.
- On logout, the refresh token is invalidated server-side (stored in a blocklist or deleted from a `refresh_tokens` table).

### 10.3 Password Requirements

- Minimum 8 characters
- Must include at least one uppercase letter, one number
- Hashed using **bcrypt** with a cost factor of 12

### 10.4 Password Reset Flow

1. User requests a password reset by submitting their email.
2. System generates a secure random token, stores its hash in the database with a 1-hour expiry, and sends a reset link to the email.
3. User clicks the link, submits a new password.
4. System validates the token (not expired, not already used), hashes the new password, updates the user record, and invalidates all existing refresh tokens for that user.

### 10.5 `refresh_tokens` Table

| Column     | Type         | Description                             |
| ---------- | ------------ | --------------------------------------- |
| id         | UUID / INT   | Primary key                             |
| user_id    | FK → users   | The user this token belongs to          |
| token_hash | VARCHAR(255) | Hashed refresh token (never store raw)  |
| expires_at | TIMESTAMP    | Expiry time                             |
| revoked    | BOOLEAN      | Set to true on logout or password reset |
| created_at | TIMESTAMP    |                                         |

### 10.6 `password_reset_tokens` Table

| Column     | Type         | Description                              |
| ---------- | ------------ | ---------------------------------------- |
| id         | UUID / INT   | Primary key                              |
| user_id    | FK → users   | The user requesting the reset            |
| token_hash | VARCHAR(255) | Hashed reset token                       |
| expires_at | TIMESTAMP    | 1-hour expiry                            |
| used       | BOOLEAN      | Set to true after the reset is completed |
| created_at | TIMESTAMP    |                                          |

### 10.7 Authorization Rules

- Every API request checks: is the token valid? is the user active?
- Role is read from the token payload, not re-fetched from DB on every request (token is the source of truth during its lifetime).
- Branch managers are additionally checked: their `store_id` in the token must match the store of any resource they are accessing or modifying.

---

## 11. Expense Management

### 11.1 Overview

The expense management module gives admins full visibility into the company's financial position — not just how much was earned, but how much was spent. It tracks two types of financial outflows:

- **Expenses** — operational costs entered manually by an admin (electricity, rent, internet, salaries, maintenance, etc.).
- **Stock Investment** — the total capital spent purchasing stock. This is **automatically calculated** from supply history (`stock_supplies.quantity × unit_purchase_price`) and requires no manual entry.

Together with sales revenue, these two figures allow the system to compute the company's true net profit for any given period.

---

### 11.2 Key Financial Concepts

| Concept              | How It's Calculated                                              | Manual Entry? |
| -------------------- | ---------------------------------------------------------------- | ------------- |
| Revenue              | SUM(`sales.total_amount`)                                        | No — auto     |
| COGS                 | SUM(`sales.quantity_sold × unit_purchase_price`)                 | No — auto     |
| Gross Profit         | Revenue − COGS                                                   | No — auto     |
| Operating Expenses   | SUM(`expenses.amount`)                                           | Yes — admin   |
| Net Profit           | Gross Profit − Operating Expenses                                | No — auto     |
| Stock Capital Invested | SUM(`stock_supplies.quantity × unit_purchase_price`)           | No — auto     |
| Current Stock Value  | SUM(`inventory.quantity × products.purchase_price`) — live      | No — auto     |

> All calculations are filterable by date range and by store.

---

### 11.3 Features & Requirements

- Admin can add a new expense with: title, amount, category, store (or company-wide), date, optional receipt, and optional notes.
- Admin can edit any existing expense.
- Admin can delete an expense (hard delete — expenses are manual records not linked to inventory).
- Expenses can be scoped to a specific store or marked as company-wide (when the cost applies to the whole business, not a single location).
- Stock investment is read-only — displayed automatically from supply records, cannot be manually edited.
- All expense data is filterable by date range, category, and store.
- The financial summary page presents the full picture: revenue, COGS, gross profit, expenses, net profit, and stock value side by side.
- Financial data is exportable as PDF or Excel.

---

### 11.4 User Stories

| ID   | Story                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-01 | As an admin, I want to add an expense with a title, amount, category, and date so that operational costs are recorded in the system.                     |
| E-02 | As an admin, I want to edit an expense I previously entered so that I can correct any mistakes.                                                          |
| E-03 | As an admin, I want to delete an expense so that incorrectly entered records can be removed.                                                             |
| E-04 | As an admin, I want to view all expenses in a list filtered by category, store, and date range so that I can review what has been spent.                 |
| E-05 | As an admin, I want to see the total expenses for a selected period at a glance so that I know the operational cost without going through every record.   |
| E-06 | As an admin, I want to see the auto-calculated stock investment so that I know how much capital has been put into purchasing stock.                       |
| E-07 | As an admin, I want to see the full financial summary (revenue, COGS, gross profit, expenses, net profit) so that I have a complete picture of the business. |
| E-08 | As an admin, I want to export the financial report as PDF or Excel so that I can share it with stakeholders.                                             |
| E-09 | As an admin, I want to attach a receipt image or file to an expense so that there is supporting documentation for each cost.                             |
| E-10 | As an admin, I want to mark an expense as company-wide or assign it to a specific store so that costs are correctly attributed.                          |

---

### 11.5 Business Rules

12. **Only admins can manage expenses.** Branch managers have no access to the expense module.
13. **Expenses are hard-deleted.** Unlike products and users, expenses can be permanently deleted since they are standalone manual records not linked to inventory or sales data.
14. **Expense date cannot be in the future.** All expenses must be dated today or earlier.
15. **Stock investment is read-only.** It is derived automatically from `stock_supplies` records and cannot be manually overridden.
16. **Company-wide expenses have no store.** The `store_id` on an expense is nullable — a null value means the expense applies to the whole company, not a specific branch.
17. **Amount must be positive.** Zero or negative expense amounts are not permitted.

---

### 11.6 Expense Page Specifications

#### Expense List Page (Admin only)

**Summary bar (top of page):**
- Total expenses for the currently filtered period — updates dynamically as filters change.

**Filters:**
- Date range picker (today / this week / this month / custom)
- Category dropdown (all / Utilities / Rent / Salaries / Maintenance / Transport / Marketing / Other)
- Store dropdown (all stores / company-wide only / specific store)

**Expense table:**

| Column     | Description                                  |
| ---------- | -------------------------------------------- |
| Date       | Expense date                                 |
| Title      | Short description of the expense             |
| Category   | Expense category                             |
| Store      | Store name, or "Company-wide" if null        |
| Amount     | Expense amount                               |
| Receipt    | Icon link if a receipt is attached           |
| Created by | Admin who entered the record                 |
| Actions    | Edit / Delete buttons                        |

**Add / Edit Expense Form (modal or dedicated page):**

| Field         | Type            | Required | Notes                                      |
| ------------- | --------------- | -------- | ------------------------------------------ |
| Title         | Text            | Yes      | e.g., "June Electricity Bill"              |
| Amount        | Decimal         | Yes      | Must be positive                           |
| Category      | Dropdown        | Yes      | From `expense_categories`                  |
| Store         | Dropdown        | No       | Includes "Company-wide" as default option  |
| Expense Date  | Date picker     | Yes      | Cannot be a future date                    |
| Receipt       | File upload     | No       | Image or PDF, stored as URL                |
| Notes         | Textarea        | No       | Any additional context                     |

---

### 11.7 Financial Summary Page (Admin only)

A dedicated page separate from the main sales dashboard. Gives a complete financial overview for any selected period and store.

#### Summary Cards

| Card                    | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Total Revenue           | SUM(`sales.total_amount`) for period                               |
| Cost of Goods Sold      | SUM(`sales.quantity_sold × unit_purchase_price`) for period        |
| Gross Profit            | Revenue − COGS                                                     |
| Total Operating Expenses| SUM(`expenses.amount`) for period                                  |
| Net Profit              | Gross Profit − Total Expenses                                      |
| Stock Capital Invested  | SUM(`stock_supplies.quantity × unit_purchase_price`) for period    |
| Current Stock Value     | SUM(`inventory.quantity × products.purchase_price`) — live today   |

#### Charts

| Chart                         | Type        | Description                                                     |
| ----------------------------- | ----------- | --------------------------------------------------------------- |
| Revenue vs COGS vs Expenses   | Grouped bar | Monthly side-by-side breakdown of all three                     |
| Net Profit Trend              | Line chart  | Monthly net profit after expenses                               |
| Expense Breakdown by Category | Pie/Donut   | What percentage of expenses belong to each category             |
| Expense by Store              | Bar chart   | Which store is spending the most on operating costs             |

#### Filters
- Date range picker (this month / this quarter / this year / custom)
- Store selector (all stores or specific store)

---

### 11.8 Audit Log Events (Expense-related)

| Event              | Trigger                         |
| ------------------ | ------------------------------- |
| `EXPENSE_CREATED`  | Admin adds a new expense        |
| `EXPENSE_UPDATED`  | Admin edits an existing expense |
| `EXPENSE_DELETED`  | Admin deletes an expense        |

---

_End of Document — Version 1.2_
