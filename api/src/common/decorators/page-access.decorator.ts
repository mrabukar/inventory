import { applyDecorators, SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { PageMark } from "../access/limited-pages";
import { Roles } from "./roles.decorator";

export const PAGES_KEY = "LIMITED_PAGES";
export const LIMITED_SELF_KEY = "LIMITED_SELF";

/**
 * Marks a read route as one a limited user may call, if an admin gave them one
 * of these pages ("*" = any page). A limited user is refused everywhere else,
 * and on every route that changes data: this is the only way in.
 *
 * Admins are always allowed; list any other roles that already used the route.
 */
export function PageRead(pages: PageMark[], ...otherRoles: UserRole[]) {
  return applyDecorators(
    SetMetadata(PAGES_KEY, pages),
    Roles(UserRole.admin, ...otherRoles, UserRole.limited_user),
  );
}

/**
 * Same as {@link PageRead} for a route that sets no roles of its own (any
 * signed-in user already reaches it): only the page marks are added.
 */
export const PageMarks = (pages: PageMark[]) => SetMetadata(PAGES_KEY, pages);

/** Marks a route as the signed-in user's own account (profile). Limited users may use it. */
export const LimitedSelf = () => SetMetadata(LIMITED_SELF_KEY, true);
