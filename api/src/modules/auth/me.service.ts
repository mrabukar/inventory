import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateMeDto } from "./dto/update-me.dto";

const storeSelect = {
  id: true,
  name: true,
  address: true,
  isActive: true,
} as const;

const organizationSelect = {
  id: true,
  name: true,
  hasStores: true,
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
} as const;

export type MeStore = {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
};

export type MeOrganization = {
  id: string;
  name: string;
  hasStores: boolean;
  logoKey: string | null;
  logoUpdatedAt: Date | null;
};

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

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
