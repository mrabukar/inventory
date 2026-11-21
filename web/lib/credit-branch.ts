/**
 * Customer billing (customers, invoices, customer payments, partial payment
 * at sale, receivables) for credit branches. On: a credit branch is its own
 * business, with its own customers, invoices and numbering, all confined to
 * the branch. Set to `false` — together with the API's matching switch in
 * `src/common/constants/credit-branch.constants.ts` — to turn it off again.
 */
export const CREDIT_BRANCH_BILLING = true;

/** Whether billing screens and sale fields apply to this user. */
export function billingAppliesTo(user: {
  billingEnabled: boolean | null;
  isCreditBranch: boolean;
} | null): boolean {
  if (!user?.billingEnabled) return false;
  if (user.isCreditBranch && !CREDIT_BRANCH_BILLING) return false;
  return true;
}
