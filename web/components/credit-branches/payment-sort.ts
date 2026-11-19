import type { BranchPaymentListQuery } from "@/service/branch-payments/branch-payments";

export type PaymentSortKey = "newest" | "oldest" | "largest" | "smallest";

export const PAYMENT_SORT_OPTIONS: { value: PaymentSortKey; label: string }[] =
  [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "largest", label: "Largest amount" },
    { value: "smallest", label: "Smallest amount" },
  ];

const PARAMS: Record<
  PaymentSortKey,
  Pick<BranchPaymentListQuery, "sortBy" | "order">
> = {
  newest: { sortBy: "createdAt", order: "desc" },
  oldest: { sortBy: "createdAt", order: "asc" },
  largest: { sortBy: "amount", order: "desc" },
  smallest: { sortBy: "amount", order: "asc" },
};

export function paymentSortParams(key: PaymentSortKey) {
  return PARAMS[key];
}
