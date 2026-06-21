import { Prisma } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { toMoneyNumber } from "./money.util";

type ProductCostFields = {
  averageCost?: Decimal | string | number | null;
};

/** Live unit cost for stock value — the moving weighted-average cost from purchases. */
export function productUnitCost(product: ProductCostFields): number {
  return toMoneyNumber(product.averageCost);
}

/** SQL expression for quantity × unit cost in raw inventory reports. */
export const productUnitCostSql = Prisma.sql`p."averageCost"`;
