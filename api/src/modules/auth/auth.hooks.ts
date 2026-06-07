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
    if (!isBootstrapSignupAllowed()) {
      await this.requireAdminSession(ctx);
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
        message: "role must be admin or branch_manager",
      });
    }

    const storeId = body?.storeId?.trim();
    if (role === UserRole.admin && storeId) {
      throw new APIError("BAD_REQUEST", {
        message: "storeId is not allowed for admin users",
      });
    }

    if (role === UserRole.branch_manager && !storeId) {
      throw new APIError("BAD_REQUEST", {
        message: "storeId is required for branch managers",
      });
    }

    if (role === UserRole.branch_manager && storeId) {
      await this.assertActiveStore(storeId);
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
        phone: true,
        isActive: true,
      },
    });

    if (!created) {
      return;
    }

    const actorId = await this.resolveAuditActorId(ctx, created.id);

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: AuditAction.USER_CREATED,
        entityType: "user",
        entityId: created.id,
        oldValue: Prisma.JsonNull,
        newValue: created,
      },
    });
  }

  private async requireAdminSession(ctx: AuthHookContext): Promise<void> {
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

    if (session.user.role !== UserRole.admin) {
      throw new APIError("FORBIDDEN", {
        message: "Only admins can create users",
      });
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

  private async assertActiveStore(storeId: string): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, isActive: true },
      select: { id: true },
    });

    if (!store) {
      throw new APIError("BAD_REQUEST", {
        message: `Store with id "${storeId}" not found`,
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
    const storeId =
      role === UserRole.admin
        ? null
        : typeof user.storeId === "string"
          ? user.storeId.trim() || null
          : (user.storeId ?? null);

    return {
      data: {
        ...user,
        isActive: true,
        storeId,
      },
    };
  }
}
