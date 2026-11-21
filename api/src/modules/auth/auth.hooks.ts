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
import { DomainPolicyService } from "../../common/tenant/domain-policy.service";
import { PrismaService } from "../../prisma/prisma.service";
import { isUserRole, UserRole } from "./auth.constants";
import type { AppAuth } from "./auth.config";
import { revokeTrustedDevices } from "./revoke-trusted-devices.util";
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
      await this.assertStoreInOrganization(
        storeId,
        organizationId,
        org.hasStores,
      );
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

  /**
   * A branch manager's store must belong to this org and be active. An org
   * with stores only assigns `standard` branches; an org without stores only
   * assigns `credit` branches (see Store.type) — its hidden warehouse has no
   * manager of its own.
   */
  private async assertStoreInOrganization(
    storeId: string,
    organizationId: string,
    orgHasStores: boolean,
  ): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, organizationId, isActive: true },
      select: { id: true, type: true, isOrgWarehouse: true },
    });

    if (!store || store.isOrgWarehouse) {
      throw new APIError("BAD_REQUEST", {
        message: `Store with id "${storeId}" not found in this organization`,
      });
    }

    const expectedType = orgHasStores ? "standard" : "credit";
    if (store.type !== expectedType) {
      throw new APIError("BAD_REQUEST", {
        message: orgHasStores
          ? "branch_manager must be assigned to a branch of this organization"
          : "branch_manager cannot be created for an organization without stores",
      });
    }
  }
}

@Hook()
@Injectable()
export class AuthSignInHook {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainPolicy: DomainPolicyService,
  ) {}

  @BeforeHook("/sign-in/email")
  async blockInactiveUsers(ctx: AuthHookContext): Promise<void> {
    const body = ctx.body as { email?: string } | undefined;
    const email = body?.email?.trim().toLowerCase();

    if (!email) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { isActive: true, role: true, organizationId: true },
    });

    if (user?.isActive === false) {
      throw new APIError("UNAUTHORIZED", {
        message: "Unauthorized",
      });
    }

    // Each organization signs in on its own domain (the platform super admin
    // on the admin domain). Answer exactly like a wrong password so nobody can
    // tell which domain an account belongs to.
    if (
      user &&
      !(await this.domainPolicy.isAllowed(ctx.headers?.get("host"), user))
    ) {
      throw new APIError("UNAUTHORIZED", {
        message: "Invalid email or password",
      });
    }
  }
}

@Hook()
@Injectable()
export class AuthTwoFactorHook {
  // Turning 2FA off goes through POST /me/two-factor/disable (admins only,
  // password + code) or an admin action on the user. Block the plugin's own
  // endpoint so no one can bypass those rules.
  @BeforeHook("/two-factor/disable")
  blockPluginDisable(): void {
    throw new APIError("FORBIDDEN", {
      message: "Ask an admin to turn off two-factor authentication",
    });
  }
}

@Hook()
@Injectable()
export class AuthChangePasswordHook {
  constructor(private readonly prisma: PrismaService) {}

  @BeforeHook("/change-password")
  validateChangePassword(ctx: AuthHookContext): void {
    const newPassword = (ctx.body as { newPassword?: string })?.newPassword;
    if (newPassword && !isStrongPassword(newPassword)) {
      throw new APIError("BAD_REQUEST", {
        message: STRONG_PASSWORD_MESSAGE,
      });
    }
  }

  @AfterHook("/change-password")
  async revokeTrustedDevicesAfterPasswordChange(
    ctx: AuthHookContext,
  ): Promise<void> {
    const userId = ctx.context.session?.user?.id;
    if (!userId) {
      return;
    }

    await revokeTrustedDevices(this.prisma, userId);
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
