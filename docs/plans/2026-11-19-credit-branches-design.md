# Credit Branches — Design

**Date:** 2026-11-19
**Status:** Implemented (see §11 for deviations and notes)

## 1. Summary

Organizations **without** branches (`hasStores = false`) can add a **credit branch**: a branch that gets stock from the organization on credit, owes the organization for it, and pays it back in parts. Each payment is approved or rejected by an admin. Apart from that, the branch sells and tracks inventory like any other branch.

Organizations **with** branches do not change.

## 2. Decisions

| Question | Decision |
|---|---|
| Who owns credited stock? | The branch. It owes the full amount whether or not it sells the stock (like selling to a shop on credit). |
| Price charged per item | Typed by the admin on each credit, pre-filled with the product's selling price. |
| Payment at credit time | The admin records what was paid then: nothing, part, or all. It counts as an approved payment. |
| Later payments | Submitted by the branch manager (any amount, any time, never more than owed). The admin approves or rejects with a reason. The balance changes only on approval. |
| Payment details | Amount, date, method (cash, EVC, eDahab, bank), reference number. No receipt photo for now. |
| Branch's own sales | Go through immediately, with no admin approval. |
| Organization's reports | Crediting stock is the organization's sale: revenue = credited price, cost = the organization's cost at that time. The branch's own sales appear only on the branch's pages. |
| Returns | Admins can record items coming back. Stock returns to the warehouse; the balance drops by the price charged for those items. |
| Customers | Each credit branch has its own customers. The branch manager sees only theirs; the admin sees all. |

## 3. Behaviour

**Admin**
- Creates a credit branch and a branch manager login for it.
- Credits stock: picks products, quantities and prices, and records any amount paid. Items move from the warehouse into the branch's stock; the unpaid remainder is added to the balance.
- Records returns against a specific credit line.
- Sees every credit branch and what it owes, each branch's statement, stock and sales, and a list of payments waiting for approval (with a count in the sidebar).

**Branch manager**
- Sells and manages stock as in any branch; sales need no approval.
- Submits payments and sees whether each one is waiting, approved or rejected (with the reason).
- Sees their own customers and a statement of everything credited, paid and returned, with the running balance.

## 4. Data model

```prisma
enum StoreType {
  standard   // every existing branch
  credit
}

model Store {
  // ...
  type StoreType @default(standard)
}

model BranchCredit {
  id             String   @id @default(cuid())
  organizationId String
  storeId        String            // the credit branch
  total          Decimal  @db.Decimal(12, 2)
  note           String?
  createdById    String
  createdAt      DateTime @default(now())
  items          BranchCreditItem[]
}

model BranchCreditItem {
  id             String  @id @default(cuid())
  branchCreditId String
  organizationId String
  productId      String
  quantity       Int
  unitPrice      Decimal @db.Decimal(10, 2)  // charged to the branch
  unitCost       Decimal @db.Decimal(10, 2)  // organization's average cost at credit time
  lineTotal      Decimal @db.Decimal(12, 2)
  returns        BranchReturn[]
}

model BranchReturn {
  id                 String   @id @default(cuid())
  organizationId     String
  storeId            String
  branchCreditItemId String           // price comes from this line
  quantity           Int
  amount             Decimal  @db.Decimal(12, 2)  // quantity × line unitPrice
  reason             String
  createdById        String
  createdAt          DateTime @default(now())
}

enum BranchPaymentMethod { cash evc edahab bank }
enum BranchPaymentStatus { pending approved rejected }

model BranchPayment {
  id              String              @id @default(cuid())
  organizationId  String
  storeId         String
  branchCreditId  String?             // set when paid at credit time
  amount          Decimal             @db.Decimal(12, 2)
  paidAt          DateTime            @db.Date
  method          BranchPaymentMethod
  reference       String?
  status          BranchPaymentStatus @default(pending)
  submittedById   String
  reviewedById    String?
  reviewedAt      DateTime?
  rejectionReason String?
  createdAt       DateTime            @default(now())
}

model Customer {
  // ...
  storeId String?   // null = the organization's own customer
}
```

New audit actions: `BRANCH_CREDIT_CREATED`, `BRANCH_RETURN_CREATED`, `BRANCH_PAYMENT_SUBMITTED`, `BRANCH_PAYMENT_APPROVED`, `BRANCH_PAYMENT_REJECTED`.

**Balance** is always calculated, never stored:
`balance = Σ credit totals − Σ return amounts − Σ approved payments`

## 5. Rules

- Credit branches can only be created in organizations with `hasStores = false`; standard stores only in organizations with `hasStores = true`. Branch-manager creation allows a credit branch in a no-store org.
- Crediting stock runs in one transaction: lock warehouse and branch inventory rows, check warehouse stock, move quantities, create the credit and its lines, and record any paid amount as an approved payment.
- A return can't exceed the line's credited quantity minus earlier returns, or the branch's current stock of that product.
- A payment (at credit time or submitted later) can't exceed the current balance including pending payments.
- Approve and reject use a conditional update on `status = pending`, so a payment is decided exactly once.
- Branch-manager sales from a credit branch are created as `active`, not `pending`.

## 6. Reports and isolation

- The admin's sales and reports in a no-store org stay pinned to the warehouse, so the branch's retail sales are excluded automatically.
- The financial summary and dashboard add credit revenue (`lineTotal`) and cost (`unitCost × quantity`), minus returns.
- Customers: branch managers see only customers with their `storeId`; admins see all, filterable by branch.
- The admin's receivables only count the organization's own customers (`storeId = null`). Money the branch's customers owe belongs to the branch.
- Invoice numbers: branch invoices share the organization's invoice sequence for now (numbers will have gaps). A per-branch sequence can come later.

## 7. API

| Endpoint | Who | Purpose |
|---|---|---|
| `GET /credit-branches` | admin | Credit branches with balances |
| `GET /credit-branches/:id/statement` | admin, that branch's manager | Ledger with running balance |
| `POST /credit-branches/:id/credits` | admin | Credit stock (+ optional paid amount) |
| `POST /credit-branches/:id/returns` | admin | Record returned items |
| `POST /branch-payments` | branch manager | Submit a payment |
| `GET /branch-payments` | admin, branch manager (own) | List, filter by status |
| `GET /branch-payments/pending-count` | admin | Sidebar badge |
| `PATCH /branch-payments/:id/approve` | admin | Approve |
| `PATCH /branch-payments/:id/reject` | admin | Reject with reason |

## 8. Screens

- **Admin:** credit branches list (balance per branch); branch detail (statement, stock, sales); credit stock form; return form; payment approvals page with sidebar count.
- **Branch manager:** "Pay" form; statement; payments list with status and rejection reasons.

## 9. Testing

Integration tests (local Postgres, like `sales-approval.e2e-spec.ts`):
- Crediting moves exact stock and sets balance = total − paid.
- Partial and full payment at credit time.
- Approve lowers the balance; reject doesn't; double decisions conflict.
- Payments above the balance are refused.
- Returns restore warehouse stock and lower the balance at the line's price; over-returns are refused.
- Branch sales are `active` immediately and excluded from the admin's reports; credit revenue and cost are included.
- Branch managers can't see other branches' or the organization's customers; receivables exclude branch customers.
- Organizations with branches are unaffected (existing tests stay green).

## 10. Out of scope

- Receipt photo on payments.
- Credit limits.
- Per-branch invoice numbering.
- Credit branches in organizations that have standard branches.

## 11. Implementation notes

- **Balance math:** `balance = Σ credits.total − Σ returns.amount − Σ approved payments.amount`, computed on read, never stored (`branch-balance.util.ts`).
- **Tenant isolation:** `BranchCredit`, `BranchCreditItem`, `BranchReturn`, `BranchPayment` were added to the Prisma tenant-scoping extension's model list (`src/prisma/tenant-scoping.extension.ts`), so every query through the shared `PrismaService` is automatically scoped to the caller's organization, matching how `Sale`, `Payment`, `Customer`, etc. already work.
- **Reports isolation gap found and fixed:** `getAdminDashboard` and `getProductDistribution` read `query.storeId` directly instead of going through `TenantStoreResolver.resolveStoreFilter`. For an organization without branches that meant "no store filter" pulled in every store's sales — safe before credit branches existed (there was only ever the warehouse), but it would have mixed a credit branch's own sales into the organization's dashboard. Both now go through the resolver, which pins to the warehouse when the organization has no branches, exactly like `getFinancialSummary` and `getAllTimeCompanyNetProfit` already did.
- **Revenue/cost timing:** a return lowers revenue and cost in the period the *return* happens, not retroactively in the original credit's period — the same approach as sale corrections.
- **Customers:** `Customer.storeId` is nullable (`null` = the organization's own customer). Existing behavior for organizations with branches is unchanged: a standard branch manager still sees every customer, and still cannot create or update one (that stayed admin-only). Only a *credit* branch manager gets the new, scoped create/update/balance/statement access, checked by store `type`, not by role alone.
- **Branch directory:** credit branches are plain `Store` rows (`type: credit`) so branch-manager login, inventory and sales reuse all existing machinery. `GET /stores` lists them for the "Add User" store picker; `StoresService.create` (the generic store endpoint) still only ever creates `standard` stores and still refuses to run in a no-branches organization, so nothing about existing orgs changed there.
- **Sale approval:** a credit branch's own sales are created as `active` immediately — `SalesService.create` checks the resolved store's `type` and skips the pending-approval path only for credit branches.
- **Tests:** `api/test/credit-branches.e2e-spec.ts` (9 cases) covering crediting, insufficient stock, sale isolation, revenue/cost counting, payment submit/approve/reject, over-payment refusal, returns, customer isolation, and a no-op check against an organization with branches.
- **Not built:** receipt photos on payments, credit limits, a per-branch invoice number sequence, and credit branches inside an organization that also has standard branches.

## 12. Customer billing switched off for credit branches (2026-11-19) — superseded by §14

A credit branch now sells exactly like a standard branch: no customers, no invoices, no customer payments, no partial payment at sale. This is behind one switch on each side rather than commented-out code, so it stays typechecked and comes back by flipping both to `true`:

- API: `CREDIT_BRANCH_BILLING` in `src/common/constants/credit-branch.constants.ts`. While off, credit-branch sales ignore `customerId`, `locationId` and `paidAmount` and create no invoice, and a credit branch manager gets 403 from customers, invoices and payments endpoints (`assertBillingAllowedForBranch`).
- Web: `CREDIT_BRANCH_BILLING` in `lib/credit-branch.ts`. While off, the Customers, Invoices and Payments links and routes are hidden from credit branch managers, and Submit Sale hides the customer, location and "paid now" fields.

Standard branches and admins are unaffected. The credit branch manager's dashboard also shows the branch's outstanding balance, amount paid and payments awaiting approval, each linking to My Branch.

## 13. Paging and sorting (2026-11-20)

Long lists no longer grow without limit.

- **Statement** (`GET /credit-branches/:id/statement`): `page`, `limit` (default 20) and `order` (`newest` default, or `oldest`). The running balance is worked out over the whole history in date order and the page is cut afterwards, so every page's balances are right in either order. Only date order is offered: sorting by another column would make the running balance meaningless. Entries with the same timestamp (a credit and the payment taken with it) keep credit, then return, then payment.
- **Payments** (`GET /branch-payments`): `page`, `limit`, `sortBy` (`createdAt`, `amount`, `paidAt`; a whitelist) and `order`. The row `id` is the last sort key so paging stays stable when values tie.
- **Pending total** (`GET /branch-payments/pending-count`) now returns `{ count, amount }`, so the "waiting" banner is right however many pages there are.
- **Web:** `Pager` ("Showing 21–40 of 134", Previous/Next) and `SortSelect` are shared. Statements show 20 per page; payment lists show 10 per page (the rows are taller). The admin review queue defaults to oldest first so nothing is forgotten; history tabs default to newest first.
- The statement still reads the branch's full history on the server to compute balances; only the response is paged. That is fine for years of normal trading, and can move to a SQL window function if a branch ever has tens of thousands of entries.

## 14. Customer billing back on for credit branches (2026-11-21)

The client wants a credit branch to have everything the organization has: customers, partial payment at the sale, invoices, customer payments, outstanding balances and receivables. `CREDIT_BRANCH_BILLING` is now `true` on both sides (API `src/common/constants/credit-branch.constants.ts`, web `lib/credit-branch.ts`). Setting both back to `false` turns it off again.

Turning it on was not safe by itself: the invoices and customer payments endpoints never limited a branch manager to their own branch (which was invisible while billing was off). So a credit branch manager is now confined to their own branch.

- **Invoices:** list and detail return only invoices of sales made at the manager's branch; another branch's invoice looks like it doesn't exist (404).
- **Customer payments:** the list shows only that branch's payments and sale-time collections; recording a payment works only for the branch's own customers and invoices.
- **Customers, balances, statements, receivables:** a credit branch manager gets their own branch's customers (list, by id, balance, statement) and a Receivables page of their own debtors. The admin's receivables stay the organization's own customers (a branch's customers owe the branch). Standard branch managers and admins behave exactly as before.
- **Selling:** a credit branch sells only to its own customers (with an optional partial payment at the sale). Any other store may use the organization's customers but not a credit branch's.
- **Invoice numbering:** a branch numbers its own invoices from 1 with its prefix (`HARG-0001`), so it never sees gaps from the organization's other sales. The organization keeps `INV-0001…`. Storage: `Invoice.series` (`""` for the organization, the store id for a branch) and uniqueness on `(organizationId, series, number)`; `Store.invoicePrefix` and `Store.nextInvoiceNumber` on the branch. The prefix comes from the branch name unless one is given (2–6 letters or numbers, unique within the organization, never `INV`), and is locked once the branch has issued an invoice. A branch created before this change gets a prefix the first time it bills.
- **What an invoice shows:** a credit branch is its own business, so its invoice prints the branch's name, address, phone and its own EVC, eDahab and bank numbers, and none of the organization's logo, stamp or signature. The admin sets these when adding or editing the branch (`PATCH /credit-branches/:id`, "Edit branch" on the branch page).
- **Migration:** `20261121120000_credit_branch_invoicing` (adds the columns above and swaps the invoice uniqueness rule; existing invoices all fall in the organization's own list).
- **Tests:** `api/test/credit-branches.e2e-spec.ts` covers separate numbering, the printed details, one branch not seeing another's invoices, payments, customers or balances, receivables scoping, partial payment at the sale, the customer rules, default and legacy prefixes, and the prefix lock.
- **Still true:** the admin's Customers, Invoices and Payments lists show every branch's records together (branch invoices are told apart by their prefix); there is no per-branch filter yet.

## 15. Credit branch sales wait for the admin again (2026-11-21)

This reverses the earlier choice that a credit branch's own sales need no approval. Every branch manager's sale, credit branches included, is now `pending` until an admin approves or rejects it. Stock still comes off at submission and goes back on rejection.

- **Invoice at approval:** a credit branch's invoice (and any partial payment taken at the counter, held in `paidAtSubmission`) is created when the admin approves, from the branch's own numbering (`HARG-0001`). A pending sale makes no invoice, so the customer owes nothing and the sale isn't in the branch's receivables until it is approved. A rejected sale makes none at all.
- **The admin's queue:** an organization without stores pins the admin's sale lists to its own stock. The pending queue is the one exception (`GET /sales?status=pending`): pending sales can only come from branch managers, so the admin sees every branch's, credit branches included. The count is organization-wide.
- **Where the admin finds it:** "Sale approvals" under Credit Branches in the sidebar (organizations with stores keep their "Approvals" link), with the pending count.
- **Unchanged:** a credit branch's sales still stay out of the organization's own reports, before and after approval; the admin's Sales page still lists the organization's own stock only.
- **Submit Sale:** a credit branch manager no longer sees the Location field (a credit branch is its own business, not a location of the organization's). Customer and the partial "paid now" amount stay.

## 16. Financial summary for a credit branch

A credit branch has its own Financial Summary, separate from the organization's.

- **Cost of goods = what the branch paid.** Each branch sale line stores the
  branch's weighted-average credit price (credits minus returns) in
  `SaleItem.unitPurchasePrice`, not the organization's own cost. Migration
  `20261121130000_credit_branch_sale_cost` re-costs existing branch sales using
  the current average (an approximation for history).
- **No expenses.** The branch manager does not record expenses, so
  profit = revenue − cost (net = gross).
- **Stock bought** = credits received − returns in the period; **stock value** =
  units held × the branch's own cost.
- **Who sees what.** The branch manager sees only their branch. The admin picks a
  branch in the Financial Summary filter (`storeId` of a credit branch); the
  default organization view still includes credit-branch revenue/cost and does
  not mix in branch sales.
- **Export.** PDF/Excel use the branch's name instead of the organization's.

## 17. Organizations stay on their own domain

Each organization signs in on one domain; the platform super admin on the hosts listed for it.

- **Where it's stored:** `Organization.domain` (migration `20261121140000_organization_domain`). Several organizations may share one domain. The super admin sets it on the new/edit organization pages.
- **Login:** `AuthSignInHook` refuses a user on the wrong domain with the same "Invalid email or password" answer as a wrong password, so nobody can tell which domain an account belongs to.
- **Every request:** `TenantInterceptor` checks the signed-in user against the request's `Host` on each call, so a valid session from one domain is refused on another (403).
- **Super admin:** only on the hosts in `PLATFORM_ADMIN_HOST` (comma-separated; it may be the organizations' own domains, e.g. `fonex.mobilephoneinventory.com,sanabil.mobilephoneinventory.com`). An organization with no domain is blocked.
- **Switch:** `ENFORCE_ORG_DOMAINS=true` (off by default). Roll out by setting every organization's domain first, then turning it on.
- **Sign-in branding:** `GET /api/public/tenant` (and `/logo`) return the organization's name and logo when exactly one active organization uses the host; otherwise the page stays generic.
- **Server:** nginx sends unknown hosts to a `444` default server; set `LISTEN_HOST=127.0.0.1` so the API can't be reached directly with a forged `Host`.
