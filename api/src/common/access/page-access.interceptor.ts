import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { from, mergeMap, Observable } from "rxjs";
import {
  LIMITED_SELF_KEY,
  PAGES_KEY,
} from "../decorators/page-access.decorator";
import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantContextService } from "../tenant/tenant-context.service";
import { ANY_PAGE } from "./limited-pages";

interface SessionRequest {
  method?: string;
  user?: CurrentUserPayload | null;
  session?: { user?: Record<string, unknown> };
}

const READ_METHODS = ["GET", "HEAD"];

/**
 * A limited user may only read, and only the routes marked for a page an admin
 * gave them. Anything else is refused: a route nobody marked stays closed.
 * Their pages are read from the database on every request, so removing a page
 * takes effect at once.
 */
@Injectable()
export class PageAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const user = request.user ?? request.session?.user;
    if (!user || user.role !== UserRole.limited_user) {
      return next.handle();
    }

    // The check below awaits a database call, and the handler would then run
    // outside the organization the tenant interceptor set: its queries would
    // see every organization's rows. Put the organization back before it runs.
    const organizationId = this.tenantContext.get();
    return from(this.assertAllowed(context, request, String(user.id))).pipe(
      mergeMap(() =>
        organizationId === undefined
          ? next.handle()
          : this.tenantContext.run(organizationId, () => next.handle()),
      ),
    );
  }

  private async assertAllowed(
    context: ExecutionContext,
    request: SessionRequest,
    userId: string,
  ): Promise<void> {
    const method = (request.method ?? "").toUpperCase();
    const targets = [context.getHandler(), context.getClass()];

    // Their own profile.
    if (
      this.reflector.getAllAndOverride<boolean>(LIMITED_SELF_KEY, targets) &&
      (READ_METHODS.includes(method) || method === "PATCH")
    ) {
      return;
    }

    const pages = this.reflector.getAllAndOverride<string[]>(
      PAGES_KEY,
      targets,
    );
    if (!pages || !READ_METHODS.includes(method)) {
      throw new ForbiddenException(
        "This account can only view the pages it was given",
      );
    }

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, allowedPages: true },
    });
    if (
      !current ||
      !current.isActive ||
      current.role !== UserRole.limited_user
    ) {
      throw new ForbiddenException("This account can't be used");
    }

    const allowed = pages.includes(ANY_PAGE)
      ? current.allowedPages.length > 0
      : pages.some((page) => current.allowedPages.includes(page));
    if (!allowed) {
      throw new ForbiddenException("You don't have access to this page");
    }
  }
}
