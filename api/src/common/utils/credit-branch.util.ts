import { ForbiddenException } from "@nestjs/common";
import { Prisma, StoreType, UserRole } from "@prisma/client";
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

/**
 * The credit branch an admin has chosen to browse, or null. Only an admin can
 * browse a branch, and only a credit branch of their own organization counts:
 * any other id (another organization's store, a standard store, nothing) is
 * ignored, which leaves the caller on the organization's own data.
 */
export async function creditBranchViewIdOf(
  prisma: PrismaService,
  user: CurrentUserPayload,
  queryStoreId?: string,
): Promise<string | null> {
  const wanted = typeof queryStoreId === "string" ? queryStoreId.trim() : "";
  if (user.role !== UserRole.admin || !user.organizationId || !wanted) {
    return null;
  }
  const store = await prisma.store.findFirst({
    where: {
      id: wanted,
      organizationId: user.organizationId,
      type: StoreType.credit,
    },
    select: { id: true },
  });
  return store?.id ?? null;
}

/**
 * Which sales' invoices and payments a caller's list may show:
 * - a credit branch manager: their own branch's;
 * - an admin browsing a credit branch: that branch's;
 * - everyone else: the organization's own, never a credit branch's.
 */
export async function billingSaleScopeOf(
  prisma: PrismaService,
  user: CurrentUserPayload,
  queryStoreId?: string,
): Promise<Prisma.SaleWhereInput> {
  const scope =
    (await creditBranchStoreIdOf(prisma, user)) ??
    (await creditBranchViewIdOf(prisma, user, queryStoreId));
  return scope
    ? { storeId: scope }
    : { store: { type: { not: StoreType.credit } } };
}
