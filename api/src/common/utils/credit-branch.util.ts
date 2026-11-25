import { ForbiddenException } from "@nestjs/common";
import { Prisma, StoreType, UserRole } from "@prisma/client";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { CREDIT_BRANCH_BILLING } from "../constants/credit-branch.constants";
import { readsLikeAdmin } from "./admin-like.util";
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
  if (!readsLikeAdmin(user.role) || !user.organizationId || !wanted) {
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

/** The `storeId` value that means every credit branch together. */
export const ALL_BRANCHES = "all";

/**
 * What a credit organization's admin is looking at:
 * - own: the organization itself (the default);
 * - branch: one credit branch;
 * - all: every credit branch together (read-only, `storeIds` lists them).
 */
export type BranchScope =
  | { kind: "own" }
  | { kind: "branch"; storeId: string }
  | { kind: "all"; storeIds: string[] };

/**
 * Reads the `storeId` a page sent. Only an admin picks a scope, "all" only in
 * a credit organization, and a branch only if it is one of this organization's
 * credit branches. Anything else leaves the caller on the organization itself.
 */
export async function branchScopeOf(
  prisma: PrismaService,
  user: CurrentUserPayload,
  queryStoreId?: string,
): Promise<BranchScope> {
  const wanted = typeof queryStoreId === "string" ? queryStoreId.trim() : "";
  if (!readsLikeAdmin(user.role) || !user.organizationId || !wanted) {
    return { kind: "own" };
  }

  if (wanted === ALL_BRANCHES) {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { hasStores: true, usesCreditBranches: true },
    });
    if (!org || org.hasStores || !org.usesCreditBranches) {
      return { kind: "own" };
    }
    const stores = await prisma.store.findMany({
      where: { organizationId: user.organizationId, type: StoreType.credit },
      select: { id: true },
    });
    return { kind: "all", storeIds: stores.map((store) => store.id) };
  }

  const storeId = await creditBranchViewIdOf(prisma, user, wanted);
  return storeId ? { kind: "branch", storeId } : { kind: "own" };
}

/**
 * Which sales' invoices and payments a caller's list may show:
 * - a credit branch manager: their own branch's;
 * - an admin browsing one credit branch, or all of them: theirs;
 * - everyone else: the organization's own, never a credit branch's.
 */
export async function billingSaleScopeOf(
  prisma: PrismaService,
  user: CurrentUserPayload,
  queryStoreId?: string,
): Promise<Prisma.SaleWhereInput> {
  const own = await creditBranchStoreIdOf(prisma, user);
  if (own) {
    return { storeId: own };
  }
  const scope = await branchScopeOf(prisma, user, queryStoreId);
  if (scope.kind === "branch") {
    return { storeId: scope.storeId };
  }
  if (scope.kind === "all") {
    return { store: { type: StoreType.credit } };
  }
  return { store: { type: { not: StoreType.credit } } };
}
