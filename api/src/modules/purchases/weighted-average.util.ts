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

/**
 * Compute the new moving weighted-average cost after reversing (voiding) part of a
 * purchase. Removes the corrected units from the value pool at the unit price
 * recorded on the original purchase — the inverse of {@link computeWeightedAverageCost}.
 *
 * Exact when no sales/distributions happened between the purchase and its
 * correction; a guarded approximation otherwise (weighted average is path-dependent).
 * @see PURCHASE_CORRECTION_DESIGN.md §3
 */
export function reverseWeightedAverageCost(
  onHand: number,
  currentAverageCost: number,
  reverseQty: number,
  originalUnitCost: number,
): number {
  if (reverseQty <= 0) {
    throw new Error("reverseQty must be positive");
  }
  if (reverseQty > onHand) {
    throw new Error("reverseQty cannot exceed on-hand quantity");
  }

  const newOnHand = onHand - reverseQty;
  if (newOnHand <= 0) {
    return 0;
  }

  const currentValue = onHand * currentAverageCost;
  const removedValue = reverseQty * originalUnitCost;
  const newValue = currentValue - removedValue;

  // Guard: a path-dependent reversal can over-remove value; never go negative.
  if (newValue <= 0) {
    return 0;
  }

  return toMoneyNumber(newValue / newOnHand);
}
