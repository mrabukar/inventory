import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import type { PrismaService } from "../../prisma/prisma.service";
import { changesUserAccess, DISABLED_AUTH_PATHS } from "../auth/auth.constants";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

// Better-Auth's crypto is ESM-only and not needed here.
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn() }));

describe("who may change a user's access", () => {
  it("keeps Better-Auth's own account update switched off", () => {
    expect(DISABLED_AUTH_PATHS).toContain("/update-user");
  });

  it.each([
    { role: "super_admin" },
    { organizationId: "other-org" },
    { storeId: null },
    { isActive: true },
  ])("spots an update that touches access: %j", (data) => {
    expect(changesUserAccess({ name: "N", ...data })).toBe(true);
  });

  it("lets ordinary account updates through", () => {
    expect(changesUserAccess({ name: "N", twoFactorEnabled: true })).toBe(
      false,
    );
  });

  it.each([
    [UserRole.admin, 0],
    [UserRole.branch_manager, 0],
    [UserRole.super_admin, 1],
  ])("validates the role %s with %i error(s)", async (role, errors) => {
    const dto = plainToInstance(UpdateUserDto, { role });
    expect(await validate(dto)).toHaveLength(errors);
  });

  it("refuses to make anyone a super admin, before reading or writing", async () => {
    const prisma = {} as PrismaService;
    const actor: CurrentUserPayload = {
      id: "admin",
      email: "admin@example.test",
      role: UserRole.admin,
      organizationId: "org",
      storeId: null,
      isActive: true,
    };
    await expect(
      new UsersService(prisma).update(
        "admin",
        { role: UserRole.super_admin },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
