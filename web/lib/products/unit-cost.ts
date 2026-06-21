import { toNumber } from "@/lib/reports/format";

/** Live unit cost for stock value — the moving weighted-average cost from purchases. */
export function productUnitCost(product: {
  averageCost?: number | string | null;
}): number {
  return toNumber(product.averageCost ?? 0);
}
