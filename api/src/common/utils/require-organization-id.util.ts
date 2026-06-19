import { BadRequestException } from "@nestjs/common";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";

export function requireOrganizationId(user: CurrentUserPayload): string {
  if (!user.organizationId) {
    throw new BadRequestException("Organization context is required");
  }
  return user.organizationId;
}
