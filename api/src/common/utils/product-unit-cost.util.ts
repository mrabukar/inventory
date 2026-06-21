import { Prisma } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { toMoneyNumber } from "./money.util";

type ProductCostFields = {
  averageCost?: Decimal | string | number | null;
  purchasePrice?: Decimal | string | number | null;
};

/** Live unit cost for stock value — prefers averageCost from purchases, legacy purchasePrice as fallback. */
export function productUnitCost(product: ProductCostFields): number {
  const average = toMoneyNumber(product.averageCost);
  if (average > 0) {
    return average;
  }

  return toMoneyNumber(product.purchasePrice);
}

/** SQL expression for quantity × unit cost in raw inventory reports. */
export const productUnitCostSql = Prisma.sql`
  CASE
    WHEN p."averageCost" > 0 THEN p."averageCost"
    ELSE p."purchasePrice"
  END
`;
