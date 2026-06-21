import { toNumber } from "@/lib/reports/format";

/** Live unit cost for stock value — prefers average cost from purchases. */
export function productUnitCost(product: {
  averageCost?: number | string | null;
  purchasePrice?: number | string | null;
}): number {
  const average = toNumber(product.averageCost ?? 0);
  if (average > 0) {
    return average;
  }
  return toNumber(product.purchasePrice ?? 0);
}
