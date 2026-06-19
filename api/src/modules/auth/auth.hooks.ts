import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import {
  AuthService,
  type AuthHookContext,
} from "@thallesp/nestjs-better-auth";
import {
  AfterHook,
  BeforeCreate,
  BeforeHook,
  DatabaseHook,
  Hook,
} from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";
import { isBootstrapSignupAllowed } from "../../config/signup-policy.util";
import { PrismaService } from "../../prisma/prisma.service";
import { isUserRole, UserRole } from "./auth.constants";
import type { AppAuth } from "./auth.config";
import {
  isStrongPassword,
  STRONG_PASSWORD_MESSAGE,
} from "./validators/password-strength.validator";

type SignUpBody = {
  password?: string;
  role?: string;
  storeId?: string;
  organizationId?: string;
  email?: string;
  name?: string;
};

@Hook()
@Injectable()
export class AuthSignUpHook {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService<AppAuth>,
  ) {}

  @BeforeHook("/sign-up/email")
  async validateSignUp(ctx: AuthHookContext): Promise<void> {
    const isBootstrap = isBootstrapSignupAllowed();
    if (!isBootstrap) {
      await this.requirePrivilegedSession(ctx);
    }

    const body = ctx.body as SignUpBody | undefined;
    const password = body?.password;
    if (password && !isStrongPassword(password)) {
      throw new APIError("BAD_REQUEST", {
        message: STRONG_PASSWORD_MESSAGE,
      });
    }

    const role = body?.role;
    if (!isUserRole(role)) {
      throw new APIError("BAD_REQUEST", {
        message: "role must be super_admin, admin, or branch_manager",
      });
    }

    if (isBootstrap && role === UserRole.super_admin) {
      // Bootstrap may create the first platform super_admin only.
    } else if (!isBootstrap && role === UserRole.super_admin) {
      throw new APIError("FORBIDDEN", {
        message: "super_admin cannot be created via sign-up",
      });
    }

    const organizationId = body?.organizationId?.trim() || undefined;
    const storeId = body?.storeId?.trim() || undefined;

    if (role === UserRole.super_admin) {
      if (organizationId) {
        throw new APIError("BAD_REQUEST", {
          message: "organizationId is not allowed for super_admin users",
        });
      }
      if (storeId) {
        throw new APIError("BAD_REQUEST", {
          message: "storeId is not allowed for super_admin users",
        });
      }
    }

    if (role === UserRole.admin) {
      if (storeId) {
        throw new APIError("BAD_REQUEST", {
          message: "storeId is not allowed for admin users",
        });
      }
      if (!isBootstrap && !organizationId) {
        throw new APIError("BAD_REQUEST", {
          message: "organizationId is required for admin users",
        });
      }
    }

    if (role === UserRole.branch_manager) {
      if (!organizationId) {
        throw new APIError("BAD_REQUEST", {
          message: "organizationId is required for branch managers",
        });
      }
      if (!storeId) {
        throw new APIError("BAD_REQUEST", {
          message: "storeId is required for branch managers",
        });
      }

      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { hasStores: true, isActive: true },
      });
      if (!org?.isActive) {
        throw new APIError("BAD_REQUEST", {
          message: `Organization with id "${organizationId}" not found`,
        });
      }
      if (!org.hasStores) {
        throw new APIError("BAD_REQUEST", {
          message:
            "branch_manager cannot be created for an organization without stores",
        });
      }

      await this.assertStoreInOrganization(storeId, organizationId);
    }

    if (!isBootstrap && organizationId) {
      await this.assertAdminMayAssignOrganization(ctx, organizationId);
    }
  }

  @AfterHook("/sign-up/email")
  async auditUserCreated(ctx: AuthHookContext): Promise<void> {
    const body = ctx.body as SignUpBody | undefined;
    const email = body?.email?.trim().toLowerCase();
    if (!email) {
      return;
    }

    const created = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        organizationId: true,
        phone: true,
        isActive: true,
      },
    });

    if (!created) {
      return;
    }

    const actorId = await this.resolveAuditActorId(ctx, created.id);

    if (!created.organizationId) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        organizationId: created.organizationId,
        action: AuditAction.USER_CREATED,
        entityType: "user",
        entityId: created.id,
        oldValue: Prisma.JsonNull,
        newValue: created,
      },
    });
  }

  private async requirePrivilegedSession(ctx: AuthHookContext): Promise<void> {
    if (!ctx.headers) {
      throw new APIError("FORBIDDEN", {
        message:
          "Sign-up requires an admin session. Sign in as admin first, or set ALLOW_SIGNUP=true for bootstrap.",
      });
    }

    const session = await this.authService.api.getSession({
      headers: ctx.headers,
    });

    if (!session?.user) {
      throw new APIError("FORBIDDEN", {
        message:
          "Sign-up requires an admin session. Sign in as admin first, or set ALLOW_SIGNUP=true for bootstrap.",
      });
    }

    const role = session.user.role;
    if (role !== UserRole.admin && role !== UserRole.super_admin) {
      throw new APIError("FORBIDDEN", {
        message: "Only admins or super admins can create users",
      });
    }
  }

  private async assertAdminMayAssignOrganization(
    ctx: AuthHookContext,
    organizationId: string,
  ): Promise<void> {
    if (!ctx.headers) {
      return;
    }

    const session = await this.authService.api.getSession({
      headers: ctx.headers,
    });

    if (session?.user?.role === UserRole.super_admin) {
      return;
    }

    if (session?.user?.role === UserRole.admin) {
      const actorOrgId =
        typeof session.user.organizationId === "string"
          ? session.user.organizationId
          : null;
      if (actorOrgId !== organizationId) {
        throw new APIError("FORBIDDEN", {
          message: "Admins can only create users in their own organization",
        });
      }
    }
  }

  private async resolveAuditActorId(
    ctx: AuthHookContext,
    createdUserId: string,
  ): Promise<string> {
    if (isBootstrapSignupAllowed()) {
      return createdUserId;
    }

    const session = ctx.headers
      ? await this.authService.api.getSession({ headers: ctx.headers })
      : null;

    return session?.user?.id ?? createdUserId;
  }

  private async assertStoreInOrganization(
    storeId: string,
    organizationId: string,
  ): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId, isActive: true },
      select: { id: true },
    });

    if (!store) {
      throw new APIError("BAD_REQUEST", {
        message: `Store with id "${storeId}" not found in this organization`,
      });
    }
  }
}

@Hook()
@Injectable()
export class AuthSignInHook {
  constructor(private readonly prisma: PrismaService) {}

  @BeforeHook("/sign-in/email")
  async blockInactiveUsers(ctx: AuthHookContext): Promise<void> {
    const body = ctx.body as { email?: string } | undefined;
    const email = body?.email?.trim().toLowerCase();

    if (!email) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { isActive: true },
    });

    if (user?.isActive === false) {
      throw new APIError("UNAUTHORIZED", {
        message: "Unauthorized",
      });
    }
  }
}

@DatabaseHook()
@Injectable()
export class AuthUserDatabaseHook {
  @BeforeCreate("user")
  beforeUserCreate(user: Record<string, unknown>) {
    const role = user.role as UserRole | undefined;

    let organizationId: string | null = null;
    if (role !== UserRole.super_admin) {
      organizationId =
        typeof user.organizationId === "string"
          ? user.organizationId.trim() || null
          : (user.organizationId as string | null) ?? null;
    }

    let storeId: string | null = null;
    if (role === UserRole.branch_manager) {
      storeId =
        typeof user.storeId === "string"
          ? user.storeId.trim() || null
          : (user.storeId as string | null) ?? null;
    }

    return {
      data: {
        ...user,
        isActive: true,
        organizationId,
        storeId,
      },
    };
  }
}
