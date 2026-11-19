export const BRANCH_PAYMENT_METHODS = [
  "cash",
  "evc",
  "edahab",
  "bank",
] as const;
export type BranchPaymentMethodValue = (typeof BRANCH_PAYMENT_METHODS)[number];

export const BRANCH_PAYMENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type BranchPaymentStatusValue = (typeof BRANCH_PAYMENT_STATUSES)[number];
