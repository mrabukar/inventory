# Build plan: browsing a credit branch from the admin

Design: `2026-11-24-credit-branch-browsing-design.md`. Built: API and web.

How the web part ended up: the selection lives in `store/branch-view.ts`
(sessionStorage). `hooks/branch-view/use-branch-view.ts` adds the selected branch
as `storeId` inside each page's data hook, and only on the browsing pages
(`BRANCH_VIEW_ROUTES`), so organization-level pages and the credit branch screens
never pick it up. The switcher is `components/shell/branch-switcher.tsx`, the
banner `components/shell/branch-view-banner.tsx`.

## What the code check found

- **Sales, inventory, reports**: already take `storeId`, but
  `TenantStoreResolver.resolveStoreFilter` throws it away for an organization
  without stores and pins the admin to the warehouse. One change there unlocks
  most pages.
- **Sale lines already carry the right cost**: `SaleItem.unitPurchasePrice` is
  stored at sale time (the branch's own cost for branch sales), so revenue,
  cost and profit from sales are correct per branch. The pieces that still use
  the organization's cost are live stock value, stock by category, stock
  investment and the previous-period comparison. `getFinancialSummary` already
  handles these through `resolveReportStore` and a `creditBranch` flag.
- **Invoices, payments, customers list**: an admin gets everything, so a
  branch's records mix into the organization's lists today. They take no store
  filter yet. Receivables already shows the organization's own customers only.
- **Read-only, what the admin can do on a branch today**:
  - Correct / submit a sale: not possible. `resolveSaleStoreId` pins the admin
    to the warehouse, so this is already read-only.
  - Edit a customer: possible (`customers.update` has no owner check for an
    admin), and an admin can create a customer into a branch via `dto.storeId`.
  - Record a payment: possible on any invoice, branch invoices included.
  - Approve / reject a branch sale: possible and stays (it is the approvals
    page, not browsing).
- **Decision from the check**: send the branch as a `storeId` query on the pages'
  reads (what sales, inventory and reports already do) rather than a hidden
  header. It is explicit, and the server needs no request-wide state.
  Read-only is enforced on records, not on what the page shows.

## API

1. **Resolver.** For an admin of an organization without stores, accept
   `storeId` when it is a credit branch of the same organization; anything
   else falls back to the warehouse. Never another organization's store, never
   a standard store. Unit-test the four cases.
2. **Reports.** Fold `resolveReportStore` into the shared lookup. In branch
   view the dashboard, product distribution, stock report and exports use the
   branch cost basis and leave out organization-level credit revenue (reuse
   the financial summary's `creditBranch` flag). Skip expenses and "top stores".
   The dashboard's previous-period comparison must use the same scope.
3. **Sales and inventory lists.** Confirm they honor the branch through step 1
   (the sales pending-queue exception stays). Check the sale detail endpoint.
4. **Invoices, payments, customers, receivables.** Add an optional `storeId` to
   their queries. With none, show the organization's own records only (not a
   credit branch's); with a credit branch's id, that branch's only. Use "not a
   credit store" rather than "is the warehouse", so organizations with stores
   see exactly what they see now.
5. **Read-only on records.** Refuse an admin's customer update, a customer
   created into a branch, and a payment on a branch's invoice, with a clear
   message. This removes things an admin can do today; the owner agreed to
   browse-only.
6. **Tests** (integration, throwaway Postgres): each list by default / branch /
   no mixing; a branch id from another organization or a standard store is
   ignored; organizations with stores unchanged; branch manager pages
   unchanged; the three refused writes.

## Web

1. **State.** A small store holding the selected branch id, kept in
   `sessionStorage` so a refresh keeps it, cleared on sign-out and sign-in.
2. **Switcher** in the navbar, shown only to an admin of an organization
   without stores that has credit branches (reuse `useCreditBranches`). Items:
   Organization, then each branch.
3. **Banner** under the navbar while a branch is selected, with a button back to
   Organization.
4. **Wire the pages.** Each page's data hook passes `storeId` from the state and
   includes it in its query key: sales, inventory, dashboard, stock report,
   product distribution, financial summary, customers, invoices, payments,
   receivables, and the report export menus. Remove the commented-out branch
   picker on the financial page in favour of the switcher.
5. **Branch labelling.** In branch view hide expenses and net-profit cards and
   show "Profit" and "Stock Bought" (the financial summary already does this),
   applied to the dashboard as well.
6. **Hide changing actions** in branch view: customer add/edit, record payment
   (and the invoice page's payment action). The server refuses them either way.
7. **Organization-level pages** (purchases, warehouse, supply, expenses,
   products, categories, stores, users, audit): hide the switcher there so it
   never looks like it applies.

## Order of work

1. API steps 1, 4, 5 and their tests (small, and fixes today's mixing).
2. API step 2 (the reports; the riskiest part).
3. Web, in one pass.
4. Run all test suites; typecheck and lint both apps; update the design file.

## Risks

- Reports: five or six queries each need the branch scope and cost basis; a
  missed one would show the organization's number under a branch's name.
  Mitigation: test each report against a branch with known figures.
- Step 5 changes what an admin can do. Mitigation: it is stated in the owner's
  decision (browse only) and covered by tests.
- Query keys: a page that forgets `storeId` in its key would show cached
  organization data after switching. Mitigation: one shared helper builds the
  params and the key.
