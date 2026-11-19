/**
 * Customer billing (customers, invoices, customer payments, partial payment
 * at sale) for credit branches. Off for now: a credit branch sells exactly
 * like a standard branch. Flip to `true` — together with the API's matching
 * switch in `src/common/constants/credit-branch.constants.ts` — to bring it back.
 */
export const CREDIT_BRANCH_BILLING = false;

/** Whether billing screens and sale fields apply to this user. */
export function billingAppliesTo(user: {
  billingEnabled: boolean | null;
  isCreditBranch: boolean;
} | null): boolean {
  if (!user?.billingEnabled) return false;
  if (user.isCreditBranch && !CREDIT_BRANCH_BILLING) return false;
  return true;
}
