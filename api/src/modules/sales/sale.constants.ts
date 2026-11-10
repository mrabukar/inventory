export const SALE_STATUSES = [
  "pending",
  "active",
  "corrected",
  "rejected",
] as const;

export type SaleStatusValue = (typeof SALE_STATUSES)[number];

/**
 * Sales that count toward revenue, profit, stock movement reports and customer
 * balances. Pending sales are not approved yet; rejected sales never happened.
 */
export const COUNTED_SALE_STATUSES: SaleStatusValue[] = ["active", "corrected"];

/** Sales whose units have left the shelf (pending sales already took stock). */
export const STOCK_OUT_SALE_STATUSES: SaleStatusValue[] = [
  "pending",
  "active",
  "corrected",
];
