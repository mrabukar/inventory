import type { Prisma, PrismaClient } from "@prisma/client";
import { toMoneyNumber } from "./money.util";

type Db = PrismaClient | Prisma.TransactionClient;

export interface BranchBalance {
  /** Sum of every BranchCredit.total ever issued to this branch. */
  totalCredited: number;
  /** Sum of every BranchReturn.amount for this branch. */
  totalReturned: number;
  /** Sum of approved BranchPayment.amount (includes amounts paid at credit time). */
  totalPaid: number;
  /** Sum of pending BranchPayment.amount — not yet owed off, but earmarked. */
  totalPending: number;
  /** What the branch currently owes: credited − returned − approved payments. */
  balance: number;
}

/**
 * A credit branch's balance is always derived from its records, never stored,
 * so it can't drift. `pending` payments don't reduce it yet — only `approved`
 * ones do — but a submitter can't stack pending payments past the balance
 * (see assertWithinBalance below).
 */
export async function getBranchBalance(
  db: Db,
  storeId: string,
): Promise<BranchBalance> {
  const [creditedAgg, returnedAgg, paidAgg, pendingAgg] = await Promise.all([
    db.branchCredit.aggregate({ where: { storeId }, _sum: { total: true } }),
    db.branchReturn.aggregate({ where: { storeId }, _sum: { amount: true } }),
    db.branchPayment.aggregate({
      where: { storeId, status: "approved" },
      _sum: { amount: true },
    }),
    db.branchPayment.aggregate({
      where: { storeId, status: "pending" },
      _sum: { amount: true },
    }),
  ]);

  const totalCredited = toMoneyNumber(creditedAgg._sum.total);
  const totalReturned = toMoneyNumber(returnedAgg._sum.amount);
  const totalPaid = toMoneyNumber(paidAgg._sum.amount);
  const totalPending = toMoneyNumber(pendingAgg._sum.amount);
  const balance = toMoneyNumber(totalCredited - totalReturned - totalPaid);

  return { totalCredited, totalReturned, totalPaid, totalPending, balance };
}
