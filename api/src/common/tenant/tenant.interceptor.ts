import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { from, mergeMap, Observable } from "rxjs";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { DomainPolicyService } from "./domain-policy.service";
import { TenantContextService } from "./tenant-context.service";

interface SessionRequest {
  headers?: Record<string, string | string[] | undefined>;
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

  if (
    role === UserRole.admin ||
    role === UserRole.branch_manager ||
    role === UserRole.limited_user
  ) {
    throw new ForbiddenException("Organization context is required");
  }

  return undefined;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly domainPolicy: DomainPolicyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const organizationId = resolveOrganizationId(request);

    const run = (): Observable<unknown> =>
      organizationId === undefined
        ? next.handle()
        : this.tenantContext.run(organizationId, () => next.handle());

    const user = request.user ?? request.session?.user;
    if (!user || !this.domainPolicy.isEnforced()) {
      return run();
    }

    // Everyone stays on their own domain: a valid session from one domain is
    // refused on another.
    const hostHeader = request.headers?.host;
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    return from(
      this.domainPolicy.isAllowed(host, {
        role: user.role as string | undefined,
        organizationId: user.organizationId as string | undefined,
      }),
    ).pipe(
      mergeMap((allowed) => {
        if (!allowed) {
          throw new ForbiddenException(
            "This account can't be used on this domain",
          );
        }
        return run();
      }),
    );
  }
}
