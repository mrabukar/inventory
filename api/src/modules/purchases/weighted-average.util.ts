import { toMoneyNumber } from "../../common/utils/money.util";

/**
 * Compute the new moving weighted-average cost after a purchase.
 * @see PURCHASING_DESIGN.md §3
 */
export function computeWeightedAverageCost(
  onHand: number,
  currentAverageCost: number,
  purchaseQty: number,
  purchaseUnitCost: number,
): number {
  if (purchaseQty <= 0) {
    throw new Error("purchaseQty must be positive");
  }

  if (onHand <= 0) {
    return toMoneyNumber(purchaseUnitCost);
  }

  const oldValue = onHand * currentAverageCost;
  const newValue = oldValue + purchaseQty * purchaseUnitCost;
  const newOnHand = onHand + purchaseQty;

  return toMoneyNumber(newValue / newOnHand);
}
