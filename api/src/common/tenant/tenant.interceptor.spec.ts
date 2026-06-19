import { CallHandler, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { of } from "rxjs";
import { TenantContextService } from "./tenant-context.service";
import { TenantInterceptor } from "./tenant.interceptor";

function createExecutionContext(user?: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

function createCallHandler(): CallHandler {
  return {
    handle: () => of("ok"),
  };
}

describe("TenantInterceptor", () => {
  let interceptor: TenantInterceptor;
  let tenantContext: TenantContextService;

  beforeEach(() => {
    tenantContext = new TenantContextService();
    interceptor = new TenantInterceptor(tenantContext);
  });

  it("proceeds without tenant context when there is no user", (done) => {
    const context = createExecutionContext();
    const next = createCallHandler();

    interceptor.intercept(context, next).subscribe({
      next: (value) => {
        expect(value).toBe("ok");
        expect(tenantContext.get()).toBeUndefined();
        done();
      },
    });
  });

  it("runs with null context for super_admin", (done) => {
    const context = createExecutionContext({
      role: UserRole.super_admin,
      organizationId: null,
    });
    const next: CallHandler = {
      handle: () => {
        expect(tenantContext.get()).toBeNull();
        return of("ok");
      },
    };

    interceptor.intercept(context, next).subscribe({
      next: (value) => {
        expect(value).toBe("ok");
        done();
      },
    });
  });

  it("runs with organizationId for admin", (done) => {
    const context = createExecutionContext({
      role: UserRole.admin,
      organizationId: "org-a",
    });
    const next: CallHandler = {
      handle: () => {
        expect(tenantContext.get()).toBe("org-a");
        return of("ok");
      },
    };

    interceptor.intercept(context, next).subscribe({
      next: (value) => {
        expect(value).toBe("ok");
        done();
      },
    });
  });

  it("throws ForbiddenException for admin without organizationId", () => {
    const context = createExecutionContext({
      role: UserRole.admin,
      organizationId: null,
    });
    const next = createCallHandler();

    expect(() => interceptor.intercept(context, next)).toThrow(
      ForbiddenException,
    );
  });

  it("throws ForbiddenException for branch_manager without organizationId", () => {
    const context = createExecutionContext({
      role: UserRole.branch_manager,
      organizationId: undefined,
    });
    const next = createCallHandler();

    expect(() => interceptor.intercept(context, next)).toThrow(
      ForbiddenException,
    );
  });
});
