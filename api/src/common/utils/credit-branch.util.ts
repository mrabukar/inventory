import { ForbiddenException } from "@nestjs/common";
import { StoreType, UserRole } from "@prisma/client";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { CREDIT_BRANCH_BILLING } from "../constants/credit-branch.constants";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * The store id of the caller's own credit branch, or null when the caller is
 * not a credit branch manager (an admin, or a standard branch manager).
 * Callers use it to confine a credit branch manager to their own branch's
 * invoices, payments, customers and balances.
 */
export async function creditBranchStoreIdOf(
  prisma: PrismaService,
  user: CurrentUserPayload,
): Promise<string | null> {
  if (user.role !== UserRole.branch_manager || !user.storeId) {
    return null;
  }
  const store = await prisma.store.findUnique({
    where: { id: user.storeId },
    select: { type: true },
  });
  return store?.type === StoreType.credit ? user.storeId : null;
}

/** True when the caller is a branch manager whose store is a credit branch. */
export async function isCreditBranchManager(
  prisma: PrismaService,
  user: CurrentUserPayload,
): Promise<boolean> {
  return (await creditBranchStoreIdOf(prisma, user)) !== null;
}

/**
 * Blocks customer billing (customers, invoices, customer payments) for credit
 * branch managers while CREDIT_BRANCH_BILLING is off. Standard branches and
 * admins are unaffected.
 */
export async function assertBillingAllowedForBranch(
  prisma: PrismaService,
  user: CurrentUserPayload,
): Promise<void> {
  if (CREDIT_BRANCH_BILLING) {
    return;
  }
  if (await isCreditBranchManager(prisma, user)) {
    throw new ForbiddenException(
      "Customer billing isn't available for credit branches",
    );
  }
}
