import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Observable } from "rxjs";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { TenantContextService } from "./tenant-context.service";

interface SessionRequest {
  user?: CurrentUserPayload | null;
  session?: { user?: Record<string, unknown> };
}

function resolveOrganizationId(
  request: SessionRequest,
): string | null | undefined {
  const user = request.user ?? request.session?.user;
  if (!user) {
    return undefined;
  }

  const role = user.role as UserRole | undefined;
  if (role === UserRole.super_admin) {
    return null;
  }

  const organizationId = user.organizationId;
  if (typeof organizationId === "string" && organizationId.trim()) {
    return organizationId.trim();
  }

  if (role === UserRole.admin || role === UserRole.branch_manager) {
    throw new ForbiddenException("Organization context is required");
  }

  return undefined;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const organizationId = resolveOrganizationId(request);

    if (organizationId === undefined) {
      return next.handle();
    }

    return this.tenantContext.run(organizationId, () => next.handle());
  }
}
