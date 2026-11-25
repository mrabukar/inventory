# Plan: organization types, branch selection on pages, limited users

Date: 2026-11-25. Status: decisions agreed with the owner, nothing built.

Replaces the top bar switcher from `2026-11-24-credit-branch-browsing-plan.md`.
The API work from that plan (branch scoping, read-only rules) stays.

## Decisions

- Three organization types: **Stores**, **Direct sales**, **Credit branches**.
- Direct sales organizations keep working as today, without credit branches.
- A credit organization makes no sales of its own. Old sales, invoices and
  customer debts stay and can still be collected.
- The branch selection leaves the top bar and sits on the pages, beside the date
  range. Credit organizations only. It offers Fonex, All branches, each branch.
- No branch selection on Products, Categories, Expenses or the Stock menu
  (Warehouse, Inventory, Stock Report).
- Limited users: the admin picks the pages a user may see. View only. Direct
  sales and credit organizations only.

## Part 0. Close two ways to gain access (do first, ship alone)

Both exist today and are independent of the features below.

1. **`POST /api/auth/update-user`.** `auth.config.ts` marks `role`, `storeId` and
   `organizationId` as `input: true`, and no hook guards this endpoint. Any
   signed-in user can set their own role and organization. Reproduced on an
   in-memory copy of those settings with the installed better-auth 1.6.14: a
   branch manager became `super_admin` of another organization (HTTP 200). Not
   tried against a deployed server.
   Fix: disable the path. The web app does not use it; profile edits go through
   `PATCH /me`. Review the library's other account endpoints at the same time.
2. **`PATCH /users/:id`.** `UpdateUserDto.role` accepts every role, so an
   organization admin can set `super_admin`, on their own account too. Found by
   reading the code; not run.
   Fix: accept only the roles an admin may assign, and check it in the service.

Tests: a branch manager and an admin each fail to change their own role,
organization and store through both routes. Normal profile edits still work.

After the fix: list users whose role is `super_admin`, or whose organization
changed, and compare with the audit log. The first route writes no audit entry.

## Part 1. Organization types

### Data
- Add `Organization.usesCreditBranches` (boolean, default false). `hasStores`
  stays. Valid states: stores; neither (direct sales); credit only. Both true is
  refused in the service.
- Migration: organizations without stores that have any credit branch become
  credit organizations.
- Billing follows the type: on for direct sales and credit. Organizations with
  stores keep whatever they have.

### API
- Create and update take one `type` (`stores` / `direct` / `credit`) in place of
  the `hasStores` and `billingEnabled` switches.
- Leaving `credit` is refused while a branch holds stock, owes money, or has a
  sale or payment waiting for approval.
- `sales.create` refuses the admin of a credit organization. `sales.correct`
  shares `resolveSaleStoreId` with it, so split the check: corrections on old
  sales stay open for 30 days.
- `customers.create` refuses the admin of a credit organization; editing stays.
- Creating a branch, crediting stock and returns require `usesCreditBranches`.
- `me` returns the type.

### Reports
- Stock report: an organization without stores counts purchases as bought. Today
  it counts store distribution, which it does not use, so it shows 0.
- Credit organization: units credited less returned count as sold in units
  sold, monthly revenue and cost, profit trend, top products and stock report.
  Today only the summary revenue, cost and profit include them.

### Web
- Super admin: one three-way choice on the new and edit pages.
- Sidebar: Credit Branches menu only for credit; Submit Sale only for direct.
- Outstanding Balance card shows for credit only while old debts remain.
- Labels that say "Direct sales" for every organization without stores.

## Part 2. Branch selection on the pages

- Remove the top bar switcher and the banner. Keep the stored choice: it
  carries between pages, survives a refresh, and resets on sign-out to Fonex.
- One shared control, placed beside the date range, or in the filter row or
  header where a page has no date range.

| Page | Place | Branch data |
|---|---|---|
| Dashboard, Sales, Financial Summary | Date range | Exists |
| Customers, Invoices, Payments, Receivables | Filters or header | Exists |
| Purchases | Date range | New: stock credited to the branch |
| Audit Log | Date range | New: actions by the branch's users |
| Users | Filters | New: filter by store |
| Sale approvals, Branch payments | Header | API exists; new control |

- Inventory and Stock Report stop following the choice.
- **All branches** (read-only): every query gains a third scope, "all credit
  branches of this organization". Lists show a Branch column. Stock is valued at
  what each branch paid, so costs are grouped by branch and product. Top
  Performing Stores ranks branches.
- `BRANCH_VIEW_ROUTES` and the data hooks keep their shape; the value becomes
  none, `all`, or a branch id. The API accepts `all` only from a credit
  organization.

Tests: for every figure, All branches equals the sum of the branches; Fonex plus
branches never mix; `all` is refused elsewhere.

## Part 3. Limited users (view only)

### Data
- New role `limited_user` and `User.allowedPages String[]`. The migration that
  adds the enum value must not use it in the same transaction.
- At least one page; only pages that exist for the organization's type.

### Pages that can be granted
Dashboard, Categories, Products, Purchases, Warehouse, Inventory, Stock Report,
Sales, Sale Approvals, Expenses, Credit Branches, Branch Payments, Customers,
Invoices, Payments, Receivables, Users, Audit Log, Financial Summary.

Never: Submit Sale, organization settings, and any change to users. Always: own
profile, password and two-factor setup.

### API: refused unless listed
- A new role is refused by `@Roles` everywhere already. Routes are opened one by
  one with a `@Pages(...)` mark naming the pages that need them.
- A global guard: a limited user passes only on a `GET` route whose mark names a
  page they hold, plus their own account routes. No mark means refused. This
  also covers routes with no `@Roles` (categories list, `health/db`).
- Pages are read from the database on each request, so changes apply at once.
- Borrowed data each page needs:

| Page | Also reads |
|---|---|
| Dashboard | receivables total, credit branch balances, low and out of stock |
| Sales, Purchases, Warehouse, Inventory, Products | categories list |
| Audit Log | user names only |
| Payments | customers, invoices, receivables |
| Customers | balance, statement, that customer's payments |
| Expenses | expense categories |

- Places that assume "not a branch manager means admin", or only protect admins:
  `tenant.interceptor` (must insist on an organization), `store-scope.util`,
  `credit-branch.util` (branch view), `customers.service`,
  `credit-branches.service`, `inventory.service`, `sales.service`, logo, stamp
  and signature services, and sign-up and user update rules.
- Only an admin creates limited users or changes their pages. Every change is
  written to the audit log.

### Web
- `mapApiUserToAppUser` treats an unknown role as admin. Unknown roles must get
  nothing.
- Users page: type "Limited user" with a page checklist.
- Sidebar, links and buttons follow the allowed pages. Sidebar counts are not
  requested for pages the user lacks.
- Sign-in, the two-factor pages and blocked addresses lead to the first allowed
  page. Today several places go straight to `/dashboard`.
- Every button that changes data is hidden.

### Tests
- Walk every API route and fail if a limited user reaches one outside the list.
- For each page: allowed with it, refused without it, and no writes.
- Removing a page takes effect on the next request.
- A limited user cannot raise their own access by any route (Part 0).

## Order and migrations

0, 1, 2, 3. Each ships alone with its tests. The store organization tests pass
unchanged every time. Migrations: Part 1 and Part 3, run by the owner.

## Assumptions to confirm

1. "No branch selection in stock" means the whole Stock menu.
2. The selection starts on Fonex at each sign-in.
