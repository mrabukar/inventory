/**
 * Customer billing (customers, invoices, customer payments, partial payment at
 * sale, receivables) for credit branches. On: a credit branch is its own
 * business, with its own customers, invoices and numbering, all confined to
 * the branch. Set to `false` — together with the web app's matching switch in
 * `lib/credit-branch.ts` — to turn it off again.
 */
export const CREDIT_BRANCH_BILLING = true;
