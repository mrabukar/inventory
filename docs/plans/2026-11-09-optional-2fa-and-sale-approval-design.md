# Optional 2FA & Sale Approval — Design

**Date:** 2026-11-09
**Status:** Implemented (see §5 for deviations from the original plan)

Two independent features:

1. **Optional 2FA** — admins can turn off 2FA for users (and themselves); users without 2FA sign in with password only.
2. **Sale approval** — sales submitted by branch managers are `pending` until an admin approves or rejects them. Stock is deducted on submission and restored on rejection.

---

## 1. Optional 2FA

### 1.1 Current state

- Better-Auth's `twoFactor` plugin only challenges for a TOTP code when `user.twoFactorEnabled = true`. Password-only login already works at the auth layer.
- "Mandatory 2FA" is enforced only on the frontend: `web/components/shell/app-shell.tsx` redirects any user with `twoFactorEnabled = false` to `/setup-2fa`.
- `PATCH /users/:id/two-factor` resets another user's 2FA (forcing re-setup) and refuses to act on the caller's own account.

### 1.2 Decisions

| Question | Decision |
|---|---|
| Who can turn 2FA off? | Admins only — for themselves and for users in their org. Super admin for any user. Branch managers cannot turn off their own. |
| Can users turn 2FA on themselves? | Yes, any role, from Profile → Security. |
| Default for new users | Required. The create-user form has a "Require two-factor authentication" toggle, on by default. |
| Self-disable protection | Admin must provide current password **and** a current TOTP code. |

### 1.3 Data model

```prisma
model User {
  // ...
  twoFactorRequired Boolean @default(true)
}

enum AuditAction {
  // ...
  USER_2FA_DISABLED
  USER_2FA_REQUIRED
}
```

Existing users get `twoFactorRequired = true` → no behaviour change on deploy.

State matrix:

| `twoFactorRequired` | `twoFactorEnabled` | Behaviour |
|---|---|---|
| true  | true  | Password + TOTP at login |
| true  | false | Forced to `/setup-2fa` |
| false | false | Password-only login |
| false | true  | Password + TOTP (user opted in) |

### 1.4 API

| Endpoint | Roles | Body | Effect |
|---|---|---|---|
| `PATCH /users/:id/two-factor` | admin, super_admin | `{ action: "disable" \| "require" \| "reset" }` | **disable:** delete `two_factor` row, `twoFactorEnabled=false`, `twoFactorRequired=false`, revoke trusted devices. **require:** `twoFactorRequired=true`. **reset:** existing behaviour (clear secret, user must re-setup). |
| `POST /me/two-factor/disable` | admin | `{ password, code }` | Verifies password and TOTP, then same as `disable` on self. |
| `POST /users` | admin, super_admin | adds `twoFactorRequired?: boolean` (default `true`) | — |
| `/api/auth/two-factor/enable` (Better-Auth) | any | `{ password }` | Self opt-in; unchanged. |

Rules: tenant isolation as today (admin → own org only). `disable` on self via `/users/:id/two-factor` is rejected — self-disable must go through `/me/two-factor/disable`. Every action writes an audit log entry.

`GET /me` and user list responses include `twoFactorRequired`.

### 1.5 Frontend

- **App shell:** redirect to `/setup-2fa` only when `twoFactorRequired && !twoFactorEnabled`.
- **Users table:** 2FA column shows **On** / **Off** / **Setup pending**. Row menu: *Turn off 2FA*, *Require 2FA*, *Reset authenticator* (shown according to state). Each opens a confirmation dialog stating the effect in plain words, e.g. "Amina will sign in with only her password."
- **Unprotected admins:** subtle "Unprotected" tag in the users table for admins with 2FA off.
- **Profile → Security:** status panel explaining the current state. Off → "Set up two-factor". Admin with 2FA on → "Turn off" (dialog: password + code). Remove the "cannot be disabled" copy.
- **Create user:** "Require two-factor authentication" toggle, on by default, with one line of help text.

---

## 2. Sale approval

### 2.1 Decisions

| Question | Decision |
|---|---|
| Who submits pending sales? | Branch managers. |
| Who approves/rejects? | Admins only. |
| Admin-recorded sales | Auto-approved (`active`). |
| Stock on submission | Deducted immediately (unchanged). |
| Stock on rejection | Restored, in one transaction. |
| Invoice timing (billing orgs) | Created at **approval**. No invoice for pending or rejected sales; no invoice-number gaps. |
| Counter payment on a rejected sale | Not recorded as money in the system; reject dialog warns that it must be refunded outside the app. |
| Rejected sale | Terminal. Branch manager submits a new sale. |

### 2.2 Data model

```prisma
enum SaleStatus {
  pending
  active      // = approved
  corrected
  rejected
}

model Sale {
  // ...
  paidAtSubmission Decimal?  @db.Decimal(10, 2) // held until the invoice exists
  reviewedById     String?
  reviewedBy       User?     @relation("SalesReviewedBy", fields: [reviewedById], references: [id])
  reviewedAt       DateTime?
  rejectionReason  String?

  @@index([status])
}

enum AuditAction {
  // ...
  SALE_APPROVED
  SALE_REJECTED
}
```

`active` keeps its meaning, so existing rows need no data migration.

### 2.3 Sale creation (`SalesService.create`)

| Actor | Status | Stock | Invoice |
|---|---|---|---|
| branch_manager | `pending` | deducted now | none; `paidAtSubmission = paidAmount` |
| admin | `active` | deducted now | created now (as today) |

Invoice creation is extracted into a shared helper used by both `create` and `approve`.

### 2.4 Endpoints

**`PATCH /sales/:id/approve`** — admin only.
In a transaction: lock the sale row, assert `status = pending` (else 409), set `active`, `reviewedById`, `reviewedAt`. Billing orgs: allocate invoice number and create the invoice from `paidAtSubmission`. Audit `SALE_APPROVED`.

**`PATCH /sales/:id/reject`** — admin only, body `{ reason }` (required, non-empty).
In a transaction: lock the sale row, assert `status = pending`, for each item lock inventory (`lockInventoryForMutation`) and add `quantitySold` back with an `INVENTORY_UPDATED` audit entry, set `rejected` + reason + reviewer. Audit `SALE_REJECTED`.

**`PATCH /sales/:id/correct`** — now refuses any sale whose status is not `active`.

**`GET /sales`** — existing `status` filter accepts the new values. Add `GET /sales/pending-count` (admin) for the sidebar badge.

Tenant isolation: admin can only approve/reject sales in their own org.

### 2.5 Reports & balances

Every `saleItem` aggregate/groupBy in `reports.service.ts` and sale queries in `customers.service.ts` must filter to `sale.status in (active, corrected)`. Also check raw SQL. This is the highest-risk part of the change — covered by tests that create a pending and a rejected sale and assert they don't appear in totals, profit, or customer balances.

### 2.6 Frontend

- **Sales list:** status filter; *Pending* first. Rejected rows dimmed with the reason.
- **Admin sidebar:** "Approvals" entry with pending count badge.
- **Approval view:** pending sale shows store, submitter, items, total, counter payment. *Approve* is one click. *Reject* opens a dialog requiring a reason; if a counter payment was taken, it warns: "$40 was collected at the counter — refund it outside the app."
- **Branch manager:** after submitting, confirmation reads "Sent for approval". Their list shows status and the rejection reason.

---

## 3. Testing

- 2FA: each state in the matrix; tenant isolation on `/users/:id/two-factor`; self-disable rejects bad password / bad code; branch manager gets 403 on disable.
- Sales: branch manager sale is pending with stock deducted and no invoice; approve creates invoice with correct paid status; reject restores exact stock; double approve/reject returns 409; correction on pending/rejected refused; reports and customer balances exclude pending and rejected.

## 4. Out of scope

- Server-side enforcement of 2FA on API requests (existing gap; frontend-only today).
- Refund/payment records for rejected sales.
- Editing a pending sale before approval.

## 5. Implementation notes

- **Stock report counts pending sales.** Revenue, profit, rankings and dashboards count only `active` + `corrected`. The stock-movement report also counts `pending`, because those units are already off the shelf; otherwise purchased − sold would not match in-stock.
- **Better-Auth's `/two-factor/disable` is blocked** by a before-hook. It was reachable by any signed-in user with only their password, which would have bypassed the admins-only rule.
- **Self-disable verifies the code server-side** (`totp.util.ts`, RFC 6238, cross-checked against Better-Auth's implementation). The password is checked by Better-Auth's `getTOTPURI`.
- **Users table:** one "Two-factor sign-in" button per row opens a dialog showing the current state and only the actions that apply, instead of a row menu. Your own row links to Profile.
- **Approvals page** lives at `/sales/approvals` (admin, only when the org has stores). It shows up to 100 pending sales, oldest first.
- **Super admin:** `/users/:id/two-factor` stays admin-only, as before. Super admins don't manage 2FA through this endpoint.
- **Correction window:** the 12-hour window still runs from `createdAt`. A sale approved more than 12 hours after it was submitted can no longer be corrected.
- **Tests:** `api/test/sales-approval.e2e-spec.ts` (8 cases) and `api/src/modules/auth/totp.util.spec.ts`.
