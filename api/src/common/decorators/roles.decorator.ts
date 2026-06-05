import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

// Must match the metadata key read by @thallesp/nestjs-better-auth AuthGuard
export const ROLES_KEY = "ROLES";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
