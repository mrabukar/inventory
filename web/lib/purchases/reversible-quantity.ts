import type { Purchase } from "@/types/purchases/purchase";

/** Max units that can still be removed on a purchase row. */
export function purchaseReversibleQuantity(purchase: Purchase): number {
  if (purchase.type !== "purchase") return 0;
  if (purchase.reversibleQuantity != null) {
    return Math.max(0, purchase.reversibleQuantity);
  }
  return Math.max(0, purchase.quantity);
}
