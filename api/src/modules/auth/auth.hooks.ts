import { Injectable } from "@nestjs/common";
import {
  BeforeCreate,
  BeforeHook,
  DatabaseHook,
  Hook,
} from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth/api";
import { PrismaService } from "../../prisma/prisma.service";
import { isPublicSignupAllowed, isUserRole, UserRole } from "./auth.constants";
import {
  isStrongPassword,
  STRONG_PASSWORD_MESSAGE,
} from "./validators/password-strength.validator";

type SignUpBody = {
  password?: string;
  role?: string;
  storeId?: string;
};

@Hook()
@Injectable()
export class AuthSignUpHook {
  @BeforeHook("/sign-up/email")
  validateSignUp(ctx: { body?: SignUpBody }): void {
    if (!isPublicSignupAllowed()) {
      throw new APIError("FORBIDDEN", {
        message: "Forbidden",
      });
    }

    const body = ctx.body;
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
  }
}

@Hook()
@Injectable()
export class AuthSignInHook {
  constructor(private readonly prisma: PrismaService) {}

  @BeforeHook("/sign-in/email")
  async blockInactiveUsers(ctx: { body?: { email?: string } }): Promise<void> {
    const body = ctx.body;
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
