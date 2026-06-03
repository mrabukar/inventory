# Multi-Location Inventory Management System
## System Design Document

**Version:** 1.1  
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

---

**Budget:** $400

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

| Action                        | Admin | Branch Manager |
|-------------------------------|-------|----------------|
| Create / manage users         | Yes   | No             |
| Create / manage products      | Yes   | No             |
| Supply stock to stores        | Yes   | No             |
| Submit sales form             | No    | Yes            |
| Correct own sale submission   | No    | Yes            |
| View own store dashboard      | Yes   | Yes            |
| View all stores dashboard     | Yes   | No             |
| Generate / export reports     | Yes   | No             |

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

### 3.7 Low Stock Alerts
- Each product-store combination has a configurable low stock threshold.
- When quantity falls at or below the threshold, a warning is shown in the admin dashboard.
- Default threshold is 5 units unless overridden.

---

## 4. User Stories

### Admin Stories

| ID   | Story |
|------|-------|
| A-01 | As an admin, I want to create a product with name, category, purchase price, and selling price so that it can be tracked in the system. |
| A-02 | As an admin, I want to supply a product to a specific store with a quantity so that the store's stock is updated. |
| A-03 | As an admin, I want to create user accounts for other admins and branch managers so that they can access the system. |
| A-04 | As an admin, I want to see a dashboard with total sales, stock levels, and charts so that I can monitor performance across all stores. |
| A-05 | As an admin, I want to see low stock warnings so that I can resupply stores before they run out. |
| A-06 | As an admin, I want to generate reports by store, product, category, or date range so that I can analyze business performance. |
| A-07 | As an admin, I want to export reports to PDF or Excel so that I can share them externally. |
| A-08 | As an admin, I want to view the full audit log so that I can track all stock and sales changes. |

### Branch Manager Stories

| ID   | Story |
|------|-------|
| B-01 | As a branch manager, I want to submit a sales form with product and quantity sold so that the system records the sale and deducts from stock. |
| B-02 | As a branch manager, I want to view my store's current stock so that I know what's available. |
| B-03 | As a branch manager, I want to correct a sales entry I submitted so that incorrect records can be fixed. |
| B-04 | As a branch manager, I want to view my store's sales history so that I can review past submissions. |
| B-05 | As a branch manager, I want to see my store's mini-dashboard so that I have an overview of my store's performance. |

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

| Column       | Type         | Description                                      |
|--------------|--------------|--------------------------------------------------|
| id           | UUID / INT   | Primary key                                      |
| name         | VARCHAR(100) | Full name                                        |
| email        | VARCHAR(150) | Unique, used for login                           |
| password     | VARCHAR(255) | Hashed password                                  |
| role         | ENUM         | `admin` or `branch_manager`                      |
| store_id     | FK → stores  | Null for admins; required for branch managers (multiple managers can share a store) |
| is_active    | BOOLEAN      | Soft delete flag (default true)                  |
| created_by   | FK → users   | Admin who created this user                      |
| created_at   | TIMESTAMP    | Auto-set on creation                             |
| updated_at   | TIMESTAMP    | Auto-updated on change                           |

---

### 6.2 `stores`

| Column     | Type         | Description              |
|------------|--------------|--------------------------|
| id         | UUID / INT   | Primary key              |
| name       | VARCHAR(100) | Store / branch name      |
| address    | TEXT         | Physical address         |
| phone      | VARCHAR(20)  | Contact number           |
| is_active  | BOOLEAN      | Soft delete flag         |
| created_at | TIMESTAMP    |                          |
| updated_at | TIMESTAMP    |                          |

---

### 6.3 `categories`

| Column      | Type        | Description                          |
|-------------|-------------|--------------------------------------|
| id          | INT         | Primary key                          |
| name        | VARCHAR(50) | `Mobiles` or `Accessories`           |
| description | TEXT        | Optional description                 |
| created_at  | TIMESTAMP   |                                      |
| updated_at  | TIMESTAMP   |                                      |

> Seeded with two fixed records: **Mobiles** and **Accessories**.

---

### 6.4 `products`

| Column         | Type           | Description                                    |
|----------------|----------------|------------------------------------------------|
| id             | UUID / INT     | Primary key                                    |
| name           | VARCHAR(150)   | Product name                                   |
| category_id    | FK → categories| Mobiles or Accessories                         |
| description    | TEXT           | Optional                                       |
| purchase_price | DECIMAL(10,2)  | Cost price (used for profit calculations)      |
| selling_price  | DECIMAL(10,2)  | Retail price                                   |
| image_url      | VARCHAR(255)   | Optional product image                         |
| is_active      | BOOLEAN        | Soft delete flag                               |
| created_by     | FK → users     | Admin who created the product                  |
| created_at     | TIMESTAMP      |                                                |
| updated_at     | TIMESTAMP      |                                                |

---

### 6.5 `inventory`

Tracks stock levels per product per store.

| Column              | Type          | Description                                         |
|---------------------|---------------|-----------------------------------------------------|
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

| Column        | Type          | Description                                              |
|---------------|---------------|----------------------------------------------------------|
| id            | UUID / INT    | Primary key                                              |
| product_id    | FK → products | Product sold                                             |
| store_id      | FK → stores   | Store where sale happened                                |
| sold_by       | FK → users    | Branch manager who submitted the sale                    |
| quantity_sold | INT           | Number of units sold                                     |
| unit_price         | DECIMAL(10,2) | Selling price snapshot at time of sale                        |
| unit_purchase_price| DECIMAL(10,2) | Purchase price snapshot at time of sale (for profit accuracy) |
| total_amount       | DECIMAL(10,2) | `quantity_sold × unit_price` (computed and stored)            |
| sale_date     | DATE          | Date of sale (can differ from submission date)           |
| note          | TEXT          | Optional manager note                                    |
| status        | ENUM          | `active` or `corrected`                                  |
| created_at    | TIMESTAMP     | Submission timestamp                                     |
| updated_at    | TIMESTAMP     |                                                          |

---

### 6.7 `sale_corrections`

| Column             | Type          | Description                                  |
|--------------------|---------------|----------------------------------------------|
| id                 | UUID / INT    | Primary key                                  |
| sale_id            | FK → sales    | The sale being corrected                     |
| original_quantity  | INT           | Quantity before correction                   |
| corrected_quantity | INT           | Quantity after correction                    |
| reason             | TEXT          | Mandatory reason for the correction          |
| corrected_by       | FK → users    | Manager who submitted the correction         |
| created_at         | TIMESTAMP     |                                              |

> **Limitation:** corrections only support changing the quantity. If the wrong product was selected on the original sale, the manager must correct the original sale quantity to zero and submit a new sale for the correct product.

---

### 6.8 `stock_supplies`

Records every time an admin sends stock to a store.

| Column       | Type          | Description                                |
|--------------|---------------|--------------------------------------------|
| id           | UUID / INT    | Primary key                                |
| product_id   | FK → products | Product being supplied                     |
| store_id     | FK → stores   | Destination store                          |
| quantity     | INT           | Units added to store inventory             |
| supplied_by  | FK → users    | Admin who performed the supply             |
| note         | TEXT          | Optional note (e.g., "Monthly restock")    |
| created_at   | TIMESTAMP     | Immutable — supply records are never edited|

---

### 6.9 `audit_logs`

Captures all significant system events automatically.

| Column      | Type         | Description                                              |
|-------------|--------------|----------------------------------------------------------|
| id          | UUID / INT   | Primary key                                              |
| user_id     | FK → users   | Who performed the action                                 |
| action      | VARCHAR(50)  | e.g., `SALE_CREATED`, `STOCK_SUPPLIED`, `SALE_CORRECTED` |
| entity_type | VARCHAR(50)  | e.g., `sale`, `inventory`, `product`                     |
| entity_id   | VARCHAR(50)  | ID of the affected record                                |
| old_value   | JSON         | State before the change (nullable)                       |
| new_value   | JSON         | State after the change (nullable)                        |
| created_at  | TIMESTAMP    |                                                          |

---

### 6.10 Entity Relationship Summary

```
users ──< sales >── products ──< inventory >── stores
                                                  ^
users ──< stock_supplies >─────────────────────────┘
sales ──< sale_corrections
users ──< audit_logs
products >── categories
users >──< stores (multiple managers can be assigned to one store)
```

---

## 7. Dashboard Specifications

### 7.1 Admin Dashboard

#### Summary Cards (top row)
| Card                  | Value                                                   |
|-----------------------|---------------------------------------------------------|
| Total Sales (Revenue) | Sum of all `sales.total_amount` (filterable by period)  |
| Total Units Sold      | Sum of all `sales.quantity_sold`                        |
| In-Stock Balance      | Total units across all stores and all products          |
| Total Profit          | Sum of `(unit_price - unit_purchase_price) × quantity_sold`  |
| Low Stock Alerts      | Count of inventory records at or below threshold        |

#### Charts
| Chart                         | Type        | Description                                              |
|-------------------------------|-------------|----------------------------------------------------------|
| Sales Trend                   | Line chart  | Daily / weekly / monthly sales revenue over time        |
| Product Distribution          | Pie/Donut   | Units sold split by category (Mobiles vs Accessories)    |
| Stock Distribution by Store   | Bar chart   | Current stock levels per store                          |
| Top Selling Products          | Bar chart   | Top 5–10 products by units sold                         |
| Top Performing Stores         | Bar chart   | Revenue by store                                        |

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
| Card             | Value                                        |
|------------------|----------------------------------------------|
| Today's Sales    | Units sold and revenue for today             |
| This Month Sales | Revenue for current month                    |
| In-Stock Balance | Total units available in their store         |
| Low Stock Items  | Products below threshold in their store      |

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

| Event              | Trigger                                      |
|--------------------|----------------------------------------------|
| `USER_CREATED`     | Admin creates a user                         |
| `PRODUCT_CREATED`  | Admin creates a product                      |
| `STOCK_SUPPLIED`   | Admin supplies stock to a store              |
| `SALE_CREATED`     | Manager submits a sale form                  |
| `SALE_CORRECTED`   | Manager corrects a sale                      |
| `INVENTORY_UPDATED`| Any change to a store's stock quantity       |
| `USER_DEACTIVATED` | Admin deactivates a user account             |
| `PRODUCT_UPDATED`  | Admin edits a product's details              |

---

## 10. Authentication & Security

### 10.1 Login Flow
1. User submits email and password.
2. System looks up the user by email. If not found or `is_active = false`, return a generic error (do not reveal which is wrong).
3. System verifies the submitted password against the stored hash using **bcrypt**.
4. On success, issue a signed **JWT access token** (expires in 15 minutes) and a **refresh token** (expires in 7 days), stored in an HTTP-only cookie.
5. On failure, return 401. After 5 consecutive failed attempts, lock the account for 15 minutes.

### 10.2 Token Management

| Token         | Expiry    | Storage          | Purpose                              |
|---------------|-----------|------------------|--------------------------------------|
| Access token  | 15 min    | HTTP-only cookie | Authenticate API requests            |
| Refresh token | 7 days    | HTTP-only cookie | Obtain a new access token silently   |

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

| Column     | Type         | Description                                  |
|------------|--------------|----------------------------------------------|
| id         | UUID / INT   | Primary key                                  |
| user_id    | FK → users   | The user this token belongs to               |
| token_hash | VARCHAR(255) | Hashed refresh token (never store raw)       |
| expires_at | TIMESTAMP    | Expiry time                                  |
| revoked    | BOOLEAN      | Set to true on logout or password reset      |
| created_at | TIMESTAMP    |                                              |

### 10.6 `password_reset_tokens` Table

| Column     | Type         | Description                                  |
|------------|--------------|----------------------------------------------|
| id         | UUID / INT   | Primary key                                  |
| user_id    | FK → users   | The user requesting the reset                |
| token_hash | VARCHAR(255) | Hashed reset token                           |
| expires_at | TIMESTAMP    | 1-hour expiry                                |
| used       | BOOLEAN      | Set to true after the reset is completed     |
| created_at | TIMESTAMP    |                                              |

### 10.7 Authorization Rules
- Every API request checks: is the token valid? is the user active?
- Role is read from the token payload, not re-fetched from DB on every request (token is the source of truth during its lifetime).
- Branch managers are additionally checked: their `store_id` in the token must match the store of any resource they are accessing or modifying.

---

*End of Document — Version 1.1*
