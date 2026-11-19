# Credit Branches — Design

**Date:** 2026-11-19
**Status:** Agreed, not yet built

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
