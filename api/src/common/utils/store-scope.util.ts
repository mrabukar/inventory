import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";

export function assertBranchManagerHasStore(user: CurrentUserPayload): string {
  if (user.role !== UserRole.branch_manager) {
    throw new ForbiddenException(
      "Only branch managers can perform this action",
    );
  }

  if (!user.storeId) {
    throw new ForbiddenException("No store assigned to your account");
  }

  return user.storeId;
}

/** Ensures a branch manager may only access their assigned store. Admins pass. */
export function assertStoreAccess(
  storeId: string,
  user: CurrentUserPayload,
): void {
  if (user.role === UserRole.admin) {
    return;
  }

  const managerStoreId = assertBranchManagerHasStore(user);

  if (managerStoreId !== storeId) {
    throw new ForbiddenException("You can only access your assigned store");
  }
}

/** Admin: optional query filter. Manager: always scoped to assigned store. */
export function resolveStoreFilter(
  user: CurrentUserPayload,
  queryStoreId?: string,
): string | undefined {
  if (user.role === UserRole.branch_manager) {
    return assertBranchManagerHasStore(user);
  }

  const trimmed =
    typeof queryStoreId === "string" ? queryStoreId.trim() : undefined;

  return trimmed || undefined;
}

/** Returns the manager's assigned store id (throws if not a manager or unassigned). */
export function requireManagerStore(user: CurrentUserPayload): string {
  return assertBranchManagerHasStore(user);
}

export type ManagerStoreLookup = (
  storeId: string,
) => Promise<{ isActive: boolean } | null>;

/**
 * Manager mutations (e.g. submit sale): store must exist and be active.
 * Use {@link requireManagerStore} for read-only paths (dashboard, sales history).
 */
export async function requireActiveManagerStore(
  user: CurrentUserPayload,
  findStore: ManagerStoreLookup,
): Promise<string> {
  const storeId = assertBranchManagerHasStore(user);
  const store = await findStore(storeId);

  if (!store) {
    throw new ForbiddenException("Your assigned store could not be found");
  }

  if (!store.isActive) {
    throw new ForbiddenException(
      "Your assigned store is inactive. This action is not allowed.",
    );
  }

  return storeId;
}
