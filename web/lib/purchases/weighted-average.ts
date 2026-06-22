/** Client-side weighted-average preview — mirrors api weighted-average.util.ts */
export function computeWeightedAverageCost(
  onHand: number,
  currentAverageCost: number,
  purchaseQty: number,
  purchaseUnitCost: number,
): number {
  if (onHand <= 0) {
    return roundMoney(purchaseUnitCost);
  }

  const oldValue = onHand * currentAverageCost;
  const newValue = oldValue + purchaseQty * purchaseUnitCost;
  const newOnHand = onHand + purchaseQty;

  return roundMoney(newValue / newOnHand);
}

/** Client-side preview of the average cost after reversing part of a purchase. */
export function reverseWeightedAverageCost(
  onHand: number,
  currentAverageCost: number,
  reverseQty: number,
  originalUnitCost: number,
): number {
  if (reverseQty <= 0 || reverseQty > onHand) {
    return roundMoney(currentAverageCost);
  }
  const newOnHand = onHand - reverseQty;
  if (newOnHand <= 0) return 0;
  const newValue = onHand * currentAverageCost - reverseQty * originalUnitCost;
  if (newValue <= 0) return 0;
  return roundMoney(newValue / newOnHand);
}

export function grossMarginPercent(
  sellingPrice: number,
  averageCost: number,
): number {
  if (sellingPrice <= 0) return 0;
  return roundMoney(((sellingPrice - averageCost) / sellingPrice) * 100);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
