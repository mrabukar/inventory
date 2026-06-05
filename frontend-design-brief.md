# Frontend Design Brief — Multi-Location Inventory Management System

**Version:** 1.0  
**Audience:** AI coding agents (Claude Code, v0)  
**Stack:** Next.js 16+, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5, TanStack Table v8, Recharts v2, Zustand v5

---

## Table of Contents

1. [Project Context](#1-project-context)
2. [Design Philosophy](#2-design-philosophy)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout Principles](#5-spacing--layout-principles)
6. [Theme System](#6-theme-system)
7. [App Shell & Navigation](#7-app-shell--navigation)
8. [Shared Components](#8-shared-components)
9. [Animation Policy](#9-animation-policy)
10. [Icon Guidelines](#10-icon-guidelines)
11. [Page Specifications — Admin](#11-page-specifications--admin)
12. [Page Specifications — Branch Manager](#12-page-specifications--branch-manager)
13. [Data Shape Reference](#13-data-shape-reference)

---

## 1. Project Context

A web-based **multi-location inventory management system** used by a central supplier (Admin) and branch managers at individual store locations. The Admin monitors stock, sales, expenses, and profit across all stores. Branch managers record daily sales at their assigned store.

**Two user roles:**
- **Admin** — full system access, manages products, users, stock supply, expenses, reports
- **Branch Manager** — store-scoped access, submits sales, views own stock and history

The system handles: product catalog, per-store inventory, sales recording, stock supply, expense tracking, financial reporting, and audit logs.

---

## 2. Design Philosophy

**Clean, modern, business-grade.** This is a professional tool used daily — it should feel premium without being distracting. Prioritize readability and clarity over visual novelty.

**Principles:**
- **White-first** — light theme is the default. The UI is bright, open, and spacious.
- **Color as meaning** — brand colors are used to communicate roles and status (revenue = indigo, profit = teal, warning = amber, loss = rose), not applied randomly for decoration.
- **Calm interactions** — no bouncing, no excessive motion. Transitions are short and purposeful.
- **Data-forward** — charts, numbers, and tables are the hero. UI chrome stays quiet.
- **Consistent density** — forms and tables use comfortable padding; dashboards use tighter cards to maximize information density without feeling cramped.

---

## 3. Color System

### 3.1 Brand Colors (Three Primary Soft Accents)

These three colors form the visual identity of the product. They are soft, distinct, and harmonious.

| Name   | Hex       | Tailwind Token    | Primary Use                                      |
|--------|-----------|-------------------|--------------------------------------------------|
| Indigo | `#6366F1` | `indigo-500`      | Primary actions, nav active state, revenue cards |
| Teal   | `#14B8A6` | `teal-500`        | Secondary accents, charts, stock/inventory data  |
| Violet | `#8B5CF6` | `violet-500`      | Financial summaries, profit metrics, reports     |

**Soft tinted backgrounds (for badges, card accents, icon backgrounds):**

| Color  | Tint Hex  | Tailwind Token |
|--------|-----------|----------------|
| Indigo | `#EEF2FF` | `indigo-50`    |
| Teal   | `#F0FDFA` | `teal-50`      |
| Violet | `#F5F3FF` | `violet-50`    |

---

### 3.2 Semantic Colors

Used for communicating status — not for decoration.

| Role     | Hex       | Tailwind Token | Use                                           |
|----------|-----------|----------------|-----------------------------------------------|
| Emerald  | `#10B981` | `emerald-500`  | Positive values, profit up, stock OK          |
| Amber    | `#F59E0B` | `amber-500`    | Warnings, low stock alerts, caution states    |
| Rose     | `#F43F5E` | `rose-500`     | Negative values, errors, delete actions, loss |

---

### 3.3 Neutral Palette

**Light Theme:**

| Token             | Hex       | Use                        |
|-------------------|-----------|----------------------------|
| Page background   | `#F5F6FA` | Main page background       |
| Card / surface    | `#FFFFFF` | Cards, modals, sidebar     |
| Border            | `#E8EAEF` | Card borders, dividers     |
| Text primary      | `#1C1F2E` | Headings, primary labels   |
| Text secondary    | `#64748B` | Sub-labels, descriptions   |
| Text muted        | `#94A3B8` | Placeholders, helper text  |
| Input background  | `#F8F9FC` | Form input backgrounds     |

**Dark Theme:**

| Token             | Hex       | Use                        |
|-------------------|-----------|----------------------------|
| Page background   | `#0D0F1A` | Main page background       |
| Card / surface    | `#151827` | Cards, modals, sidebar     |
| Border            | `#252840` | Card borders, dividers     |
| Text primary      | `#F1F3FF` | Headings, primary labels   |
| Text secondary    | `#94A3B8` | Sub-labels, descriptions   |
| Text muted        | `#64748B` | Placeholders, helper text  |
| Input background  | `#1C1F30` | Form input backgrounds     |

---

### 3.4 Color Semantics for Financial Data

Apply consistently across all dashboards, cards, and charts:

| Metric              | Color  | Rationale                      |
|---------------------|--------|--------------------------------|
| Revenue             | Indigo | Primary business metric        |
| COGS                | Slate  | Neutral cost indicator         |
| Gross Profit        | Teal   | Growth / positive output       |
| Operating Expenses  | Amber  | Caution — money going out      |
| Net Profit (pos)    | Violet | Premium positive outcome       |
| Net Profit (neg)    | Rose   | Alert — business is losing     |
| Stock Value         | Indigo | Inventory capital              |
| Low Stock Alert     | Amber  | Warning state                  |

---

## 4. Typography

Use **Inter** as the primary typeface (available via `next/font/google`).

| Role             | Size      | Weight    | Color          |
|------------------|-----------|-----------|----------------|
| Page heading     | `text-2xl`| `700`     | Text primary   |
| Section heading  | `text-lg` | `600`     | Text primary   |
| Card label       | `text-sm` | `500`     | Text secondary |
| Card value       | `text-3xl`| `700`     | Text primary   |
| Table header     | `text-xs` | `600`     | Text secondary |
| Table cell       | `text-sm` | `400`     | Text primary   |
| Badge / tag      | `text-xs` | `500`     | Varies by type |
| Helper / muted   | `text-xs` | `400`     | Text muted     |

---

## 5. Spacing & Layout Principles

- **Page padding:** `px-6 py-6` on all main content areas
- **Card padding:** `p-5` for stat cards, `p-6` for content cards
- **Gap between cards:** `gap-4` for stat card grids, `gap-6` for section grids
- **Section spacing:** `space-y-6` between major page sections
- **Table row height:** comfortable — `h-12` per row minimum
- **Sidebar width:** `240px` expanded, `64px` collapsed
- **Max content width:** `max-w-screen-2xl mx-auto` — do not constrain to a narrow column

---

## 6. Theme System

### Implementation

Use `next-themes` for theme management. Persist preference in `localStorage`. Apply class strategy (`class` on `<html>`).

```tsx
// Root layout wraps with ThemeProvider
<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
  {children}
</ThemeProvider>
```

### Toggle Button

Located in the **top navbar**, right side, before the user avatar. Use a single icon button that switches between `Sun` (light mode active) and `Moon` (dark mode active) icons from Lucide React.

- No label, icon only
- `ghost` variant button
- Tooltip: "Switch to dark mode" / "Switch to light mode"
- Transition: `duration-200` color fade only — no spin, no scale

### CSS Variable Approach

Define all colors as CSS variables in `globals.css` using Tailwind's dark variant. All component colors reference variables so theme switching is automatic without class duplication.

---

## 7. App Shell & Navigation

### 7.1 Overall Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│                      Top Navbar                          │
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  Sidebar   │           Main Content Area                 │
│            │                                             │
│            │                                             │
└────────────┴─────────────────────────────────────────────┘
```

- Sidebar is fixed on the left, full height
- Top navbar is fixed, full width, sits above the content area
- Main content scrolls independently

---

### 7.2 Top Navbar

**Height:** `h-14`  
**Background:** White (light) / Card surface (dark)  
**Border bottom:** 1px `border-border`

**Left side:**
- Sidebar collapse toggle button (`PanelLeft` icon, ghost variant)
- Current page title or breadcrumb (text-base, font-semibold)

**Right side (flex row, gap-2):**
1. Theme toggle button (Sun / Moon)
2. User avatar button — circular, shows initials (e.g., "WA" for Walaa), with dropdown:
   - User name and role label
   - Divider
   - "Log out" option (with `LogOut` icon, rose text on hover)

---

### 7.3 Sidebar

**Width:** `240px` expanded, `64px` collapsed (icon-only mode)  
**Background:** White (light) / Card surface (dark)  
**Border right:** 1px `border-border`  
**Collapse:** Toggle via the top navbar button. State stored in Zustand. Animate width with `transition-all duration-200`.

**Top of sidebar:**
- Logo / app name: "Inventra" (or project name) — text logo in indigo, bold. On collapse, show a small square indigo icon only.

**Navigation items structure:**

```tsx
{
  label: string,
  href: string,
  icon: LucideIcon,
  badge?: number  // for Low Stock Alerts count
}
```

**Active state:** Indigo-50 background, indigo-600 text and icon, left border 2px indigo-500.  
**Inactive state:** Transparent background, text-secondary, on hover: soft gray background (`hover:bg-slate-100 dark:hover:bg-slate-800`).

**Admin Sidebar Navigation Items:**

| Label              | Icon            | Route                    |
|--------------------|-----------------|--------------------------|
| Dashboard          | `LayoutDashboard`| `/admin/dashboard`      |
| Products           | `Package`        | `/admin/products`       |
| Inventory          | `Layers`         | `/admin/inventory`      |
| Sales              | `ShoppingCart`   | `/admin/sales`          |
| Stock Supply       | `Truck`          | `/admin/supply`         |
| Expenses           | `CreditCard`     | `/admin/expenses`       |
| Financial Summary  | `TrendingUp`     | `/admin/financial`      |
| Reports            | `FileBarChart`   | `/admin/reports`        |
| Users              | `Users`          | `/admin/users`          |
| Audit Log          | `ClipboardList`  | `/admin/audit`          |

**Branch Manager Sidebar Navigation Items:**

| Label          | Icon            | Route                       |
|----------------|-----------------|-----------------------------|
| Dashboard      | `LayoutDashboard`| `/manager/dashboard`       |
| Submit Sale    | `PlusCircle`     | `/manager/sales/new`       |
| My Stock       | `Package`        | `/manager/stock`           |
| Sales History  | `History`        | `/manager/sales`           |

**Bottom of sidebar (both roles):**
- Store/role indicator chip: small badge showing the user's role ("Admin") or store name ("Store A — Manager"). Subtle, muted styling.

---

## 8. Shared Components

### 8.1 Stat Card

Used in dashboard summary rows.

```
┌────────────────────────────────┐
│  [Icon]          [Trend badge] │
│                                │
│  $124,500                      │
│  Total Revenue                 │
└────────────────────────────────┘
```

**Specs:**
- White card, `rounded-xl`, `border border-border`, `p-5`
- Icon: placed in a soft-colored circle (`w-10 h-10 rounded-full`), background uses the brand color's 50 tint, icon uses the brand color
- Value: `text-3xl font-bold text-primary`
- Label: `text-sm font-medium text-muted-foreground` below the value
- Optional trend badge: small pill, top-right corner — shows `+12.4%` in emerald or `-3.2%` in rose with a small `TrendingUp` / `TrendingDown` icon
- **No hover effect.** No scale, no shadow change, no lift. The card is static.

---

### 8.2 Data Table

Built with TanStack Table v8, styled with shadcn/ui `Table` component.

**Structure:**
- White card wrapper with `rounded-xl border`
- Table header: sticky, `bg-muted/30`, text-xs uppercase, font-600, text-secondary
- Rows: `h-12`, alternating row: very subtle `bg-slate-50/50 dark:bg-slate-900/20` on even rows
- Action column: always last, right-aligned, contains icon buttons (`Edit`, `Trash2`, `Eye`) — ghost variant, small size
- Empty state: centered illustration text + description ("No records found") with a neutral icon
- Loading state: skeleton rows (use shadcn `Skeleton` component)

**Above the table (filter bar):**
- Left: search input with `Search` icon
- Right: filter dropdowns (store, category, date range), then an "Export" button (outline variant)
- Filters on one horizontal line; wrap to two lines on smaller screens

---

### 8.3 Form Modal / Sheet

Forms that add or edit records open in a **Sheet** (side drawer from the right, from shadcn/ui) rather than a centered modal — this keeps the background data visible for context.

- Sheet width: `480px` on desktop, full width on mobile
- Header: title ("Add Expense", "Edit Product") + close button
- Body: scrollable form fields
- Footer: "Cancel" (ghost) and "Save" (indigo primary) buttons, sticky at bottom of sheet

**Form field specs:**
- Label above input (not floating)
- Input: full width, `rounded-lg`, standard border, indigo focus ring
- Required fields: asterisk in rose next to the label
- Error message: rose text below the input, `text-xs`
- Dropdown (Select): shadcn `Select` component
- Date picker: shadcn `DatePicker` with Popover
- Textarea: min 3 rows

---

### 8.4 Badge / Status Chip

```tsx
// Variants
<Badge variant="indigo">Admin</Badge>
<Badge variant="teal">In Stock</Badge>
<Badge variant="amber">Low Stock</Badge>
<Badge variant="rose">Inactive</Badge>
<Badge variant="emerald">Active</Badge>
<Badge variant="slate">Company-wide</Badge>
```

All badges: `rounded-full`, `px-2.5 py-0.5`, `text-xs font-medium`, colored text on colored-50 background.

---

### 8.5 Page Header

Appears at the top of every main content page.

```
[Page Title]              [Primary Action Button]
[Optional description]
```

- Title: `text-2xl font-bold`
- Description: `text-sm text-muted-foreground`
- Action button (e.g., "Add Product", "Add Expense"): indigo, right-aligned, with a `Plus` icon

---

### 8.6 Confirmation Dialog

For destructive actions (delete expense, deactivate user, deactivate product).

- shadcn `AlertDialog`
- Title: "Are you sure?"
- Description: specific message ("This expense will be permanently deleted.")
- Buttons: "Cancel" (outline) + "Delete" / "Deactivate" (rose/destructive variant)

---

### 8.7 Toast Notifications

Use shadcn `Sonner` (or `useToast`). Position: bottom-right.

| Trigger             | Toast type | Message example                   |
|---------------------|------------|-----------------------------------|
| Record created      | Success    | "Expense added successfully"      |
| Record updated      | Success    | "Product updated"                 |
| Record deleted      | Success    | "Expense deleted"                 |
| Validation error    | Error      | "Please fill all required fields" |
| Stock insufficient  | Error      | "Insufficient stock for this sale"|
| Network error       | Error      | "Something went wrong. Try again" |

---

### 8.8 Empty State

Used when tables or lists have no records.

- Centered in the card/table area
- Lucide icon (relevant to the section, e.g., `Package` for products, `Receipt` for expenses) in a large soft-colored circle
- Heading: "No [items] found"
- Sub-text: "Add your first [item] to get started." or "Try adjusting your filters."
- Optional CTA button if applicable

---

### 8.9 Filter Bar

Reusable filter row used above most tables and on the dashboard.

Components (left to right, flex row, gap-2, wrapping):
- Date range picker (shadcn `DateRangePicker` or two date inputs)
- Store selector dropdown (admin only)
- Category selector dropdown (where applicable)
- Status/type selector (where applicable)
- "Clear filters" text button (appears only when filters are active)

All dropdowns use shadcn `Select`. Filters trigger TanStack Query refetch with updated query params.

---

## 9. Animation Policy

**Allowed transitions:**
- Theme toggle: `duration-200` color/background fade
- Sidebar collapse: `transition-all duration-200` width change
- Sheet / modal open-close: shadcn default slide animation (keep as-is)
- Dropdown / popover: shadcn default fade-in (keep as-is)
- Toast appear: shadcn default slide-in (keep as-is)
- Page navigation: none (instant) — do not add page transition animations
- Chart initial render: Recharts built-in draw animation on mount only, disabled on re-render (`isAnimationActive={false}` on subsequent renders)
- Skeleton loading: shadcn `Skeleton` shimmer (CSS only, no JS animation)

**Explicitly forbidden:**
- Card hover: no scale, no shadow elevation change, no translate-y lift
- Button hover: color change only (no scale, no glow)
- Table row hover: subtle background tint only (`hover:bg-muted/40`), no movement
- Icon hover: no spin, no bounce
- Number counters: no animated count-up on load
- Scroll-triggered animations: none

---

## 10. Icon Guidelines

**Library:** Lucide React (installed by default with shadcn/ui).

**Approved icons by context:**

| Context              | Icon(s)                                         |
|----------------------|-------------------------------------------------|
| Dashboard            | `LayoutDashboard`                               |
| Products             | `Package`, `PackageSearch`                      |
| Inventory            | `Layers`, `Archive`                             |
| Sales                | `ShoppingCart`, `Receipt`                       |
| Stock supply         | `Truck`, `PackagePlus`                          |
| Expenses             | `CreditCard`, `Wallet`                          |
| Financial summary    | `TrendingUp`, `PieChart`                        |
| Reports              | `FileBarChart`, `FileText`                      |
| Users                | `Users`, `UserPlus`, `UserCheck`                |
| Audit log            | `ClipboardList`, `History`                      |
| Store / location     | `Store`, `MapPin`                               |
| Low stock alert      | `AlertTriangle`                                 |
| Positive trend       | `TrendingUp`                                    |
| Negative trend       | `TrendingDown`                                  |
| Edit                 | `Pencil`                                        |
| Delete               | `Trash2`                                        |
| View / detail        | `Eye`                                           |
| Add / create         | `Plus`, `PlusCircle`                            |
| Export               | `Download`                                      |
| Filter               | `Filter`, `SlidersHorizontal`                   |
| Search               | `Search`                                        |
| Calendar / date      | `Calendar`                                      |
| Log out              | `LogOut`                                        |
| Theme light          | `Sun`                                           |
| Theme dark           | `Moon`                                          |
| Collapse sidebar     | `PanelLeft`                                     |
| Correct / fix        | `SquarePen`                                     |
| Categories           | `Tag`                                           |
| Password / lock      | `Lock`                                          |
| Success              | `CheckCircle2`                                  |
| Error                | `XCircle`                                       |

**Forbidden icons:** `Sparkles`, `Wand`, `Wand2`, `Bot`, `Brain`, `Cpu`, `Zap`, `Star` (in AI context), `Magic` — this is a business tool, not an AI product.

**Icon sizing:**
- In sidebar nav: `w-5 h-5`
- In stat card icon circle: `w-5 h-5`
- In button: `w-4 h-4` with `mr-2`
- In table action buttons: `w-4 h-4`
- In empty state: `w-10 h-10`
- In badge: `w-3 h-3`

---

## 11. Page Specifications — Admin

---

### 11.1 Login Page

**Route:** `/login`  
**Access:** Public (redirect to role dashboard if already authenticated)

**Layout:** Full-page centered. Two-column on desktop: left decorative panel, right form.

**Left panel (desktop only, ~45% width):**
- Gradient background using the 3 brand colors: diagonal soft gradient from `indigo-50` to `teal-50` to `violet-50`
- App logo and name centered
- Tagline: "Manage your inventory. Across every store."
- Three soft illustrative stat blocks (non-interactive, decorative): "Total Products", "Active Stores", "Monthly Sales" — placeholder numbers styled as mini stat cards, purely visual

**Right panel (form area):**
- White background, centered vertically
- Card: `max-w-md w-full mx-auto p-8 rounded-2xl`
- Heading: "Welcome back" (`text-2xl font-bold`)
- Sub-heading: "Sign in to your account" (`text-sm text-muted-foreground`)
- Form fields:
  - Email (label: "Email address", type: `email`, placeholder: "you@example.com")
  - Password (label: "Password", type: `password` with show/hide toggle using `Eye`/`EyeOff` icon)
- "Sign in" button: full width, indigo, `h-11`
- Error state: rose-bordered alert box above the button — "Invalid email or password."
- No "sign up", no "forgot password" link on the visible form (password reset is admin-initiated)

**Mobile:** Single column, form only (no left panel).

---

### 11.2 Admin Dashboard

**Route:** `/admin/dashboard`  
**Access:** Admin only

**Page header:**
- Title: "Dashboard"
- Right: Filter bar (date range, store selector)

**Section 1 — Stat Cards (8 cards, 4 per row on large screens, 2 per row on tablet)**

| Card                | Icon            | Color  | Value Source                                    |
|---------------------|-----------------|--------|-------------------------------------------------|
| Total Revenue       | `TrendingUp`    | Indigo | SUM(`sales.total_amount`) for period           |
| Gross Profit        | `TrendingUp`    | Teal   | Revenue − COGS                                  |
| Net Profit          | `TrendingUp`    | Violet | Gross Profit − Total Expenses (rose if negative)|
| Total Expenses      | `CreditCard`    | Amber  | SUM(`expenses.amount`) for period               |
| Current Stock Value | `Layers`        | Indigo | SUM(`inventory.quantity × purchase_price`)      |
| In-Stock Balance    | `Package`       | Teal   | Total units across all stores                   |
| Low Stock Alerts    | `AlertTriangle` | Amber  | Count of inventory records at/below threshold   |
| Units Sold          | `ShoppingCart`  | Violet | SUM(`sales.quantity_sold`) for period           |

**Section 2 — Charts (2 columns grid)**

**Left column (wider, ~60%):**
- **Revenue vs COGS vs Expenses** — Recharts `BarChart`, grouped, 3 bars per month
  - Bar 1: Revenue — Indigo (`#6366F1`)
  - Bar 2: COGS — Slate (`#94A3B8`)
  - Bar 3: Expenses — Amber (`#F59E0B`)
  - X-axis: months, Y-axis: currency
  - Legend below chart
  - Tooltip shows all 3 values on hover

- **Net Profit Trend** — Recharts `LineChart`
  - Single line: Violet (`#8B5CF6`) when positive, Rose when negative (use `ReferenceLine` at 0)
  - Filled area under the line with 20% opacity of the line color
  - X-axis: months, Y-axis: currency

**Right column (~40%):**
- **Expense Breakdown** — Recharts `PieChart` (donut style, `innerRadius=60`)
  - Colors per category using the brand palette cycling: indigo, teal, violet, amber, emerald, rose, slate
  - Center label: total expense amount
  - Legend below

- **Product Distribution** — Recharts `PieChart` (donut)
  - 2 slices: Mobiles (indigo) and Accessories (teal)
  - Center label: total units sold

**Section 3 — Second chart row (3 columns)**

- **Top Selling Products** — Recharts `BarChart` horizontal
  - Shows top 5–8 products by units sold
  - Bar color: teal
  - Product name on Y-axis, units on X-axis

- **Top Performing Stores** — Recharts `BarChart` horizontal
  - Revenue per store
  - Bar color: indigo
  - Store name on Y-axis, revenue on X-axis

- **Stock Distribution by Store** — Recharts `BarChart` vertical
  - Current stock units per store
  - Bar color: violet

**Section 4 — Tables (2 columns)**

**Recent Sales (left):**
- Card with heading "Recent Sales" + "View all" link (indigo, right-aligned)
- Columns: Date, Store, Product, Qty, Amount, Manager
- 10 most recent rows
- Amount column: right-aligned, indigo text

**Low Stock Warnings (right):**
- Card with heading "Low Stock Alerts" + amber `AlertTriangle` icon in heading
- Columns: Product, Store, Current Qty, Threshold
- Qty column: rose text if at/below threshold
- Ordered by most critical first (lowest qty / threshold ratio)
- Empty state: emerald icon + "All stock levels are healthy"

**Section 5 — Recent Activity Feed**
- Full-width card, heading "Recent Activity"
- Vertical list, each item:
  - Left: icon in soft-colored circle (per event type)
  - Middle: action description ("Admin supplied 50 × iPhone 15 to Store A") + timestamp (relative: "2 hours ago")
  - Right: nothing (no actions)
- Max 15 items, "View full audit log" link at bottom

---

### 11.3 Products Page

**Route:** `/admin/products`  
**Access:** Admin only

**Page header:** "Products" + "Add Product" button (indigo, `Plus` icon)

**Filter bar:** Search by name, category dropdown (All / Mobiles / Accessories), status toggle (Active / Inactive / All)

**Table columns:**

| Column          | Notes                                                     |
|-----------------|-----------------------------------------------------------|
| Name            | Product name, bold                                        |
| Category        | Badge: Indigo for Mobiles, Teal for Accessories           |
| Purchase Price  | Right-aligned, muted text                                 |
| Selling Price   | Right-aligned, bold                                       |
| Margin          | Calculated: `((selling - purchase) / purchase) × 100`% — emerald text |
| Status          | Badge: emerald "Active" / rose "Inactive"                 |
| Created by      | Admin name, muted                                         |
| Actions         | `Pencil` (edit), `PowerOff` (deactivate) or `Power` (reactivate) |

**Add / Edit Product Sheet (right drawer):**

Fields:
- Name (text, required)
- Category (Select: Mobiles / Accessories, required)
- Description (Textarea, optional)
- Purchase Price (number input, required, min 0.01)
- Selling Price (number input, required, must be ≥ purchase price — show validation)

Note: No image upload field.

**Deactivate:** `AlertDialog` confirmation — "This product will be hidden from sales forms. Historical records are preserved."

---

### 11.4 Inventory Page

**Route:** `/admin/inventory`  
**Access:** Admin only

**Page header:** "Inventory" (no add button — inventory is created via stock supply)

**Filter bar:** Store selector, category selector, status filter (All / Low Stock / Out of Stock)

**View toggle (top right of table card):** Grid icon / List icon — toggle between card grid view and table view.

**Table view columns:**

| Column           | Notes                                                        |
|------------------|--------------------------------------------------------------|
| Product          | Product name + category badge                               |
| Store            | Store name with `Store` icon                                |
| Quantity         | Right-aligned; amber text if at/below threshold, rose if 0  |
| Threshold        | Low stock threshold value                                   |
| Status           | Badge: "OK" (emerald), "Low" (amber), "Out" (rose)          |
| Stock Value      | `quantity × purchase_price` — indigo text                   |
| Last Updated     | Relative time                                               |

**Card grid view (alternative):** Each inventory record as a card:
- Product name (bold)
- Store name (with icon)
- Large quantity number — colored per status
- Progress bar: `quantity / (threshold × 3)` as a visual fill — green to amber to red as it depletes
- Category badge

---

### 11.5 Sales Page

**Route:** `/admin/sales`  
**Access:** Admin only (view all stores)

**Page header:** "Sales" + "Export" button (outline, `Download` icon)

**Filter bar:** Date range, store selector, category selector, product search

**Summary bar** (below filters, above table): 3 inline stats
- Total Sales: [count] transactions
- Total Revenue: [amount] in indigo
- Total Units: [count] sold

**Table columns:**

| Column        | Notes                                                              |
|---------------|--------------------------------------------------------------------|
| Date          | Sale date, not submission time                                     |
| Store         | Store name                                                         |
| Product       | Product name + category badge                                      |
| Manager       | Branch manager name                                                |
| Qty Sold      | Right-aligned                                                      |
| Unit Price    | Snapshot at time of sale — right-aligned, muted                    |
| Total Amount  | `qty × unit_price` — right-aligned, indigo, bold                   |
| Profit        | `qty × (unit_price − unit_purchase_price)` — emerald/rose text     |
| Status        | Badge: "Active" (emerald) or "Corrected" (amber)                   |
| Actions       | `Eye` (view detail) — read-only for admin                          |

**Sale detail modal:** When `Eye` is clicked, show a read-only modal with all sale fields including the purchase price snapshot and any corrections made.

---

### 11.6 Stock Supply Page

**Route:** `/admin/supply`  
**Access:** Admin only

**Page header:** "Stock Supply" + "New Supply" button (indigo)

**Filter bar:** Date range, store selector, product search

**Table columns:**

| Column          | Notes                                                         |
|-----------------|---------------------------------------------------------------|
| Date            | Supply date                                                   |
| Product         | Product name + category badge                                 |
| Store           | Destination store                                             |
| Qty Supplied    | Positive (normal supply), or rose + "Correction" badge if negative |
| Unit Cost       | `unit_purchase_price` snapshot — muted                        |
| Total Investment| `qty × unit_purchase_price` — indigo                          |
| Supplied by     | Admin name                                                    |
| Note            | Truncated, `Eye` icon to expand                               |

> Negative-quantity rows display a amber "Correction" badge and the quantity in rose text.

**New Supply Sheet:**

Fields:
- Product (searchable Select — searches `products.name`, required)
- Store (Select — lists all active stores, required)
- Quantity (integer, required, positive only for standard supply)
- Unit Purchase Price (decimal, pre-filled from `products.purchase_price` but editable, required)
- Note (Textarea, optional)

---

### 11.7 Expenses Page

**Route:** `/admin/expenses`  
**Access:** Admin only

**Page header:** "Expenses" + "Add Expense" button (indigo)

**Summary bar** (dynamic — updates as filters change):
- Total Expenses: [amount] in amber, bold
- Record count: "[n] expenses"

**Filter bar:** Date range, category selector, store selector (includes "Company-wide" option)

**Table columns:**

| Column      | Notes                                                             |
|-------------|-------------------------------------------------------------------|
| Date        | Expense date                                                      |
| Title       | Expense description, bold                                         |
| Category    | Badge (color-coded per category — cycle through brand colors)     |
| Store       | Store name, or "Company-wide" badge (slate) if `store_id` is null|
| Amount      | Right-aligned, amber text, bold                                   |
| Created by  | Admin name, muted                                                 |
| Actions     | `Pencil` (edit), `Trash2` (delete — with confirmation dialog)     |

**Add / Edit Expense Sheet:**

Fields:
- Title (text, required, e.g., "June Electricity Bill")
- Amount (decimal, required, must be positive)
- Category (Select from `expense_categories`, required)
- Store (Select — options: "Company-wide" + all active stores, optional, defaults to Company-wide)
- Expense Date (date picker, required, no future dates)
- Notes (Textarea, optional)

No file upload field.

**Delete:** `AlertDialog` — "This expense will be permanently deleted. This action cannot be undone."

---

### 11.8 Financial Summary Page

**Route:** `/admin/financial`  
**Access:** Admin only

**Page header:** "Financial Summary" + "Export" button (outline, `Download` icon)

**Filter bar (prominent, top of page):** Date range picker + store selector — these drive all data on the page.

**Section 1 — Summary Cards (7 cards, 4+3 grid)**

| Card                   | Icon         | Color  | Value                                              |
|------------------------|--------------|--------|----------------------------------------------------|
| Total Revenue          | `TrendingUp` | Indigo | SUM(`sales.total_amount`)                          |
| Cost of Goods Sold     | `Package`    | Slate  | SUM(`qty_sold × unit_purchase_price`)              |
| Gross Profit           | `TrendingUp` | Teal   | Revenue − COGS                                     |
| Total Expenses         | `CreditCard` | Amber  | SUM(`expenses.amount`)                             |
| Net Profit             | `TrendingUp` | Violet | Gross Profit − Expenses (rose icon+color if negative)|
| Stock Capital Invested | `Truck`      | Indigo | SUM(`supply_qty × unit_purchase_price`)            |
| Current Stock Value    | `Layers`     | Teal   | SUM(`inventory.qty × purchase_price`) live         |

**Section 2 — P&L Breakdown Card**

Vertical stacked breakdown showing the financial formula visually:

```
Revenue                    $124,500    [indigo bar, full width]
− Cost of Goods Sold        $78,200    [slate bar, proportional]
= Gross Profit              $46,300    [teal bar, proportional]
− Operating Expenses        $12,800    [amber bar, proportional]
= Net Profit                $33,500    [violet bar, proportional]
```

Each line: label on left, amount on right, colored horizontal bar filling proportionally. This replaces a chart for clear financial reading.

**Section 3 — Charts (2 columns)**

- **Revenue vs COGS vs Expenses** — Grouped bar (same as dashboard)
- **Net Profit Trend** — Line chart (same as dashboard)
- **Expense Breakdown by Category** — Donut pie chart
- **Expense by Store** — Horizontal bar (which store has highest operating costs)

**Section 4 — Stock Investment Table**

List of supply records contributing to stock investment for the period:
- Columns: Date, Product, Store, Qty, Unit Cost, Total Investment
- Footer row: Total — bold, indigo

---

### 11.9 Reports Page

**Route:** `/admin/reports`  
**Access:** Admin only

**Page header:** "Reports"

**Layout:** Left sidebar of report types + right content area showing the selected report.

**Report type list (left, clickable):**

| Report               | Icon          |
|----------------------|---------------|
| Sales Report         | `ShoppingCart`|
| Stock Report         | `Layers`      |
| Profit Report        | `TrendingUp`  |
| Supply History       | `Truck`       |
| Audit Log            | `ClipboardList`|
| Financial Overview   | `FileBarChart`|

**Active report (right):**
- Shows relevant filter bar at top
- Below filters: a summary stat row (2–3 key numbers for the filtered data)
- Full-width data table with all columns for that report
- Bottom right: "Export PDF" and "Export Excel" buttons (outline, with `Download` icon)

---

### 11.10 Users Page

**Route:** `/admin/users`  
**Access:** Admin only

**Page header:** "Users" + "Add User" button (indigo)

**Filter bar:** Role filter (All / Admin / Branch Manager), Status filter (Active / Inactive), search by name or email

**Table columns:**

| Column    | Notes                                                           |
|-----------|-----------------------------------------------------------------|
| Name      | Full name, bold                                                 |
| Email     | Muted text                                                      |
| Role      | Badge: Indigo "Admin" / Teal "Branch Manager"                   |
| Store     | Store name for managers, "—" dash for admins                    |
| Status    | Badge: Emerald "Active" / Rose "Inactive"                       |
| Created   | Date + "by [admin name]"                                        |
| Actions   | `Pencil` (edit), `PowerOff`/`Power` (deactivate/reactivate)    |

**Add / Edit User Sheet:**

Fields:
- Full Name (text, required)
- Email (email, required, unique)
- Password (password input, required for new users only — "Set password" on create, hidden on edit)
- Role (Select: Admin / Branch Manager, required)
- Store (Select — appears only when Role = Branch Manager, required for managers)

**Deactivate:** `AlertDialog` — "This user will be deactivated and cannot log in. Their historical data is preserved."

---

### 11.11 Audit Log Page

**Route:** `/admin/audit`  
**Access:** Admin only

**Page header:** "Audit Log"

**Filter bar:** Date range, user selector, action type selector (multi-select: SALE_CREATED, STOCK_SUPPLIED, EXPENSE_CREATED, etc.)

**Table columns:**

| Column      | Notes                                                                   |
|-------------|-------------------------------------------------------------------------|
| Timestamp   | Full date + time                                                         |
| User        | Name + role badge                                                        |
| Action      | Badge — color-coded:                                                     |
|             | • SALE_CREATED → Teal                                                   |
|             | • STOCK_SUPPLIED → Indigo                                               |
|             | • EXPENSE_CREATED / UPDATED / DELETED → Amber                          |
|             | • SALE_CORRECTED → Rose                                                 |
|             | • USER_CREATED / DEACTIVATED → Violet                                   |
|             | • PRODUCT_CREATED / UPDATED → Slate                                     |
| Entity      | Entity type + ID (e.g., "sale #1042")                                   |
| Summary     | Short human-readable description of the change                          |
| Detail      | `Eye` icon — opens a modal showing `old_value` vs `new_value` JSON diff |

---

## 12. Page Specifications — Branch Manager

---

### 12.1 Branch Manager Dashboard

**Route:** `/manager/dashboard`  
**Access:** Branch Manager only (scoped to their store)

**Page header:** "Dashboard — [Store Name]" — store name is displayed prominently in the heading to remind the manager of their scope.

**Section 1 — Stat Cards (4 cards, 2×2 grid)**

| Card             | Icon           | Color  | Value                                              |
|------------------|----------------|--------|----------------------------------------------------|
| Today's Sales    | `ShoppingCart` | Indigo | Revenue for today from their store                 |
| This Month Sales | `TrendingUp`   | Teal   | Revenue for current month from their store         |
| In-Stock Balance | `Package`      | Violet | Total units at their store                         |
| Low Stock Items  | `AlertTriangle`| Amber  | Products at/below threshold at their store         |

**Section 2 — Charts (2 columns)**

- **Sales Trend** — Recharts `LineChart` — daily revenue for the past 30 days, indigo line
- **Stock by Category** — Recharts `PieChart` donut — Mobiles (indigo) vs Accessories (teal) units at their store

**Section 3 — Tables (2 columns)**

- **My Recent Sales** — last 10 submissions — columns: Date, Product, Qty, Amount, Status
- **My Stock Levels** — all products at their store — columns: Product, Category, Qty, Threshold, Status badge

---

### 12.2 Submit Sale Page

**Route:** `/manager/sales/new`  
**Access:** Branch Manager only

**Page header:** "Submit Sale"

**Layout:** Centered, single-column, max-width `max-w-lg`. This is the most frequently used page — keep it clean and fast.

**Form card (white, `rounded-2xl`, `p-8`):**

Fields:
- **Product** (searchable Select, required)
  - Dropdown lists only products with active inventory at this manager's store
  - Each option shows: product name + category badge + available quantity in muted text
  - Example option: "iPhone 15 · Mobiles · 47 units available"
- **Quantity** (integer input, required, min 1)
  - Inline validation: if entered qty > available stock → rose error message appears immediately: "Only [n] units available"
- **Sale Date** (date picker, required, max today, min today−7 days)
  - Default: today
- **Note** (Textarea, optional, placeholder "Optional note about this sale")

**Auto-filled (shown as read-only info below the form):**
- Store: [Manager's store name] — read-only chip
- Manager: [Manager's name] — read-only chip
- Unit Selling Price: auto-filled from `products.selling_price` — shown as info text ("Price: $1,000 per unit")
- Total Amount: calculated live as the manager types quantity — shown prominently: "Total: **$3,000**"

**Submit button:** Full width, indigo, `h-12`, "Record Sale"

**On success:**
- Toast: "Sale recorded successfully"
- Reset form to defaults (keep date as today)
- Option to show a small summary card: "You recorded [3] × iPhone 15 — $3,000" with a green checkmark

---

### 12.3 My Stock Page

**Route:** `/manager/stock`  
**Access:** Branch Manager only (scoped to their store)

**Page header:** "My Stock — [Store Name]"

**Filter bar:** Category selector, status filter (All / Low Stock / Out of Stock), search by product name

**Summary bar:**
- Total Products: [n]
- Total Units: [n]
- Low Stock Items: [n] — amber text if > 0

**Table columns:**

| Column     | Notes                                                              |
|------------|--------------------------------------------------------------------|
| Product    | Product name, bold                                                 |
| Category   | Badge (Indigo Mobiles / Teal Accessories)                          |
| Quantity   | Right-aligned; amber if at/below threshold, rose text if 0         |
| Threshold  | Low stock threshold                                                |
| Status     | Badge: "OK" (emerald), "Low" (amber), "Out of Stock" (rose)        |

No add/edit actions — this is read-only for managers.

---

### 12.4 Sales History Page

**Route:** `/manager/sales`  
**Access:** Branch Manager only (shows their submissions only)

**Page header:** "Sales History"

**Filter bar:** Date range, product search, status filter (All / Active / Corrected)

**Table columns:**

| Column    | Notes                                                                  |
|-----------|------------------------------------------------------------------------|
| Date      | Sale date                                                              |
| Product   | Product name + category badge                                          |
| Qty Sold  | Right-aligned                                                          |
| Unit Price| Snapshot at time of sale, muted                                        |
| Total     | `qty × unit_price` — indigo, bold                                      |
| Status    | Badge: "Active" (emerald) / "Corrected" (amber)                        |
| Actions   | `SquarePen` (correct) — opens correction sheet; disabled if status is "Corrected" |

**Correction Sheet (right drawer):**

Triggered by the `SquarePen` action on a sale row. Header: "Correct Sale".

Read-only summary at the top of the sheet:
- Product: [name]
- Original Quantity: [n]
- Sale Date: [date]

Editable fields:
- Corrected Quantity (integer, required, min 0)
- Reason (Textarea, required, placeholder "Explain why this sale is being corrected")

On submit:
- If corrected qty < original qty → system adds the difference back to stock
- If corrected qty > original qty → system deducts the additional units (validates against available stock)
- Sale marked as "Corrected", `sale_corrections` record created

---

## 13. Data Shape Reference

These are the exact field names from the database that frontend components should map to. Use these when building TanStack Query hooks, table column definitions, and form schemas.

### Sales

```ts
type Sale = {
  id: string
  product_id: string
  product: { name: string; category: { name: string } }
  store_id: string
  store: { name: string }
  sold_by: string
  manager: { name: string }
  quantity_sold: number
  unit_price: number           // snapshot — selling price at time of sale
  unit_purchase_price: number  // snapshot — purchase price at time of sale
  total_amount: number         // quantity_sold × unit_price
  sale_date: string            // ISO date
  note: string | null
  status: 'active' | 'corrected'
  created_at: string
}
```

### Inventory

```ts
type Inventory = {
  id: string
  product_id: string
  product: { name: string; purchase_price: number; category: { name: string } }
  store_id: string
  store: { name: string }
  quantity: number
  low_stock_threshold: number
  updated_at: string
}
```

### Expense

```ts
type Expense = {
  id: string
  title: string
  amount: number
  category_id: number
  category: { name: string }
  store_id: string | null      // null = company-wide
  store: { name: string } | null
  expense_date: string
  note: string | null
  created_by: string
  creator: { name: string }
  created_at: string
  updated_at: string
}
```

### Stock Supply

```ts
type StockSupply = {
  id: string
  product_id: string
  product: { name: string; category: { name: string } }
  store_id: string
  store: { name: string }
  quantity: number             // negative for corrective supplies
  unit_purchase_price: number  // snapshot at time of supply
  supplied_by: string
  supplier: { name: string }
  note: string | null
  created_at: string
}
```

### Product

```ts
type Product = {
  id: string
  name: string
  category_id: number
  category: { name: string }
  description: string | null
  purchase_price: number
  selling_price: number
  is_active: boolean
  created_by: string
  creator: { name: string }
  created_at: string
}
```

### User

```ts
type User = {
  id: string
  name: string
  email: string
  role: 'admin' | 'branch_manager'
  store_id: string | null
  store: { name: string } | null
  is_active: boolean
  created_by: string
  created_at: string
}
```

### Dashboard Summary (Admin)

```ts
type AdminDashboardSummary = {
  total_revenue: number
  total_units_sold: number
  cogs: number
  gross_profit: number
  total_expenses: number
  net_profit: number
  current_stock_value: number
  in_stock_balance: number
  low_stock_count: number
}
```

### Dashboard Summary (Manager)

```ts
type ManagerDashboardSummary = {
  today_revenue: number
  today_units_sold: number
  month_revenue: number
  in_stock_balance: number
  low_stock_count: number
}
```

---

*This brief is the single source of truth for the frontend UI. All pages, components, and data shapes are derived from `system-design.md` v1.2 and `tech-stack.md` v1.0. Do not invent data fields or routes not listed here.*
