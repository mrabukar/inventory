import type { Prisma, PrismaClient } from "@prisma/client";
import { toMoneyNumber } from "./money.util";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * What a credit branch paid, on average, for a product: the prices it was
 * credited at, weighted by quantity, with returned units taken out at the
 * price of the line they came from. It is the branch's cost of goods (not the
 * organization's own cost) and is recorded on each of its sales.
 *
 * Returns null when nothing is left to average (the product was never
 * credited to the branch, or every credited unit was returned).
 */
export async function branchUnitCost(
  db: Db,
  storeId: string,
  productId: string,
): Promise<number | null> {
  const lines = await db.branchCreditItem.findMany({
    where: { storeId, productId },
    select: {
      quantity: true,
      unitPrice: true,
      returns: { select: { quantity: true } },
    },
  });

  let units = 0;
  let value = 0;
  for (const line of lines) {
    const returned = line.returns.reduce((sum, r) => sum + r.quantity, 0);
    const kept = line.quantity - returned;
    units += kept;
    value += kept * Number(line.unitPrice);
  }

  return units > 0 ? toMoneyNumber(value / units) : null;
}
