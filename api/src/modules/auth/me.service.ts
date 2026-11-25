import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { PrismaService } from "../../prisma/prisma.service";
import type { AppAuth } from "./auth.config";
import { DisableOwnTwoFactorDto } from "./dto/disable-own-two-factor.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { revokeTrustedDevices } from "./revoke-trusted-devices.util";
import { secretFromTotpUri, verifyTotp } from "./totp.util";

const storeSelect = {
  id: true,
  name: true,
  address: true,
  isActive: true,
  type: true,
} as const;

const organizationSelect = {
  id: true,
  name: true,
  hasStores: true,
  usesCreditBranches: true,
  billingEnabled: true,
  phone: true,
  evcNumber: true,
  edahabNumber: true,
  accountNumber: true,
  address: true,
  logoKey: true,
  logoUpdatedAt: true,
} as const;

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  storeId: true,
  organizationId: true,
  isActive: true,
  phone: true,
  twoFactorEnabled: true,
  twoFactorRequired: true,
} as const;

export type MeStore = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  type: "standard" | "credit";
};

export type MeOrganization = {
  id: string;
  name: string;
  hasStores: boolean;
  usesCreditBranches: boolean;
  billingEnabled: boolean;
  phone: string | null;
  evcNumber: string | null;
  edahabNumber: string | null;
  accountNumber: string | null;
  address: string | null;
  logoKey: string | null;
  logoUpdatedAt: Date | null;
};

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService<AppAuth>,
  ) {}

  async getProfile(sessionUser: Record<string, unknown>) {
    const userId =
      typeof sessionUser.id === "string" ? sessionUser.id.trim() : "";
    if (!userId) {
      throw new NotFoundException("User not found");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [store, organization] = await Promise.all([
      user.storeId != null
        ? this.prisma.store.findUnique({
            where: { id: user.storeId },
            select: storeSelect,
          })
        : Promise.resolve(null),
      user.organizationId
        ? this.prisma.organization.findUnique({
            where: { id: user.organizationId },
            select: organizationSelect,
          })
        : Promise.resolve(null),
    ]);

    return {
      user: {
        ...user,
        store,
        organization,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateMeDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
        ...(dto.phone !== undefined
          ? { phone: dto.phone?.trim() || null }
          : undefined),
      },
      select: userSelect,
    });

    if (existing.organizationId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          organizationId: existing.organizationId,
          action: AuditAction.USER_UPDATED,
          entityType: "user",
          entityId: userId,
          oldValue: this.toAuditSnapshot(existing),
          newValue: this.toAuditSnapshot(updated),
        },
      });
    }

    const [store, organization] = await Promise.all([
      updated.storeId != null
        ? this.prisma.store.findUnique({
            where: { id: updated.storeId },
            select: storeSelect,
          })
        : Promise.resolve(null),
      updated.organizationId
        ? this.prisma.organization.findUnique({
            where: { id: updated.organizationId },
            select: organizationSelect,
          })
        : Promise.resolve(null),
    ]);

    return {
      user: {
        ...updated,
        store,
        organization,
      },
    };
  }

  /**
   * Admin turns off their own 2FA. Requires the current password and a live
   * authenticator code so a hijacked session alone cannot strip 2FA.
   */
  async disableOwnTwoFactor(
    userId: string,
    dto: DisableOwnTwoFactorDto,
    headers: Headers,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException("Two-factor authentication is already off");
    }

    // Better-Auth checks the password and returns the URI holding the secret.
    let totpURI: string;
    try {
      ({ totpURI } = await this.authService.api.getTOTPURI({
        body: { password: dto.password },
        headers,
      }));
    } catch {
      throw new BadRequestException("Incorrect password");
    }

    const secret = secretFromTotpUri(totpURI);
    if (!secret || !verifyTotp(dto.code, secret)) {
      throw new BadRequestException("That code is incorrect or has expired");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.twoFactor.deleteMany({ where: { userId } });
      await revokeTrustedDevices(tx, userId);
      await tx.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorRequired: false },
      });
    });

    if (user.organizationId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          organizationId: user.organizationId,
          action: AuditAction.USER_2FA_DISABLED,
          entityType: "user",
          entityId: userId,
          oldValue: {
            twoFactorEnabled: true,
            twoFactorRequired: user.twoFactorRequired,
          },
          newValue: {
            twoFactorEnabled: false,
            twoFactorRequired: false,
            changedBy: userId,
          },
        },
      });
    }
  }

  private toAuditSnapshot(
    user: Prisma.UserGetPayload<{ select: typeof userSelect }>,
  ): Prisma.InputJsonValue {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      storeId: user.storeId,
      phone: user.phone,
      isActive: user.isActive,
    };
  }
}
