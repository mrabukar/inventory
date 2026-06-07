export const SALE_STATUSES = ["active", "corrected"] as const;

export type SaleStatusValue = (typeof SALE_STATUSES)[number];
