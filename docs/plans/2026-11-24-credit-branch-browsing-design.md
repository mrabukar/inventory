# Browsing a credit branch from the organization admin

Date: 2026-11-24 · Status: design agreed, not built

## Goal

The admin of an organization without stores can look at any of their credit
branches' data (dashboard, sales, stock, reports, customers, invoices,
payments, receivables) without signing in as the branch. By default the admin
sees only the organization's own data; picking a branch shows that branch's.

Decisions made with the owner:

- **One switcher in the top bar**, not a dropdown on each page.
- **Browse only.** Viewing a branch never changes its data.

## 1. The switcher (web)

- Shown only to an admin whose organization has no stores and has at least one
  credit branch. Items: "Organization" (default), then each branch by name.
- The choice follows the admin across pages and survives a refresh
  (browser storage). It resets to "Organization" on a new sign-in.
- A banner under the top bar says "Viewing <branch>, read-only" with a button
  back to "Organization".
- While a branch is selected, buttons that change data are hidden (sale
  corrections, add/edit customer, record payment, and so on).
- Pages that follow the switcher: dashboard, sales, inventory, stock report,
  financial summary, customers, invoices, payments, receivables.
- Organization-level pages do not use it: purchases, warehouse, supply,
  expenses, products, categories, stores, users, audit. Where a branch makes no
  sense they keep showing the organization (or hide the switcher).
- Every page sends the selected branch as `storeId`. One shared hook owns the
  selection so no page keeps its own copy.

## 2. The API

- **Shared lookup.** `TenantStoreResolver.resolveStoreFilter` pins an admin of a
  no-stores organization to the warehouse and ignores `storeId`. It will accept
  a `storeId` that is a credit branch of the admin's own organization, and
  nothing else (never another organization's store, never a standard store).
  `resolveReportStore` in `reports.service.ts` already does this for the
  financial summary and can be folded into it.
- **Branch figures.** Dashboard and report numbers for a branch use the
  branch's own cost (`branchUnitCost`, what it paid the organization) and leave
  out the organization-level credit revenue, as the financial summary does.
  Expenses do not apply to a branch.
- **No mixing in the default view.** Invoices, payments and customers lists
  currently return everything for an admin, so a branch's records appear in the
  organization's own lists. With no branch selected they return the
  organization's own records only (customers with `storeId` null, invoices and
  payments whose sale is in the organization's own stock). With a branch
  selected they return that branch's only. Receivables already shows only the
  organization's own customers; it gains the branch option.
- **Read-only.** The server cannot see which branch the page is showing, so it
  is enforced on the records: an admin's write that touches a credit branch's
  records (correcting its sale, editing its customers, recording a payment on
  its invoices) is refused. To check during planning: which of these an admin
  can do today, since that would change.

## 3. Tests and safety

- For each list: organization by default, a branch when selected, no mixing in
  either direction.
- An admin cannot select another organization's branch, or a standard store.
- A branch manager's own pages are unchanged.
- Organizations with stores are unchanged (the switcher never appears and the
  lookup behaves as before).

## Open items for the plan

1. List every admin write endpoint that can reach a branch's records and decide
   refuse vs allow (see Read-only above).
2. Decide the exact pages and components for the switcher state (shared hook,
   where the banner lives, how pages read it).
3. Confirm the dashboard and stock-report queries each need the branch cost
   basis, and which ones do not.
