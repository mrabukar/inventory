import { UserRole } from "@prisma/client";

/**
 * Roles that read an organization's data like its admin does: the admin, and a
 * limited user (who may only read, and only the pages they were given: the
 * routes enforce that, not this check).
 */
export function readsLikeAdmin(role: string | null | undefined): boolean {
  return role === UserRole.admin || role === UserRole.limited_user;
}
