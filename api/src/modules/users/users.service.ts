import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, User, UserRole } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginatedResult } from "../stores/stores.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserQueryDto } from "./dto/user-query.dto";

export type UserWithStore = Prisma.UserGetPayload<{
  include: { store: { select: { id: true; name: true } } };
}>;

type SafeUser = Omit<UserWithStore, "accounts" | "sessions">;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UserQueryDto): Promise<PaginatedResult<SafeUser>> {
    const { page, limit, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(typeof isActive === "boolean" ? { isActive } : undefined),
      ...(role ? { role } : undefined),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          store: { select: { id: true, name: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: CurrentUserPayload,
  ): Promise<SafeUser> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);
    const nextRole = dto.role ?? existing.role;
    const hasStoreIdField = dto.storeId !== undefined;
    const nextStoreId = hasStoreIdField
      ? this.resolveStoreIdForRole(nextRole, dto.storeId ?? undefined)
      : nextRole === UserRole.admin
        ? null
        : existing.storeId;

    if (nextRole === UserRole.branch_manager && !nextStoreId) {
      throw new BadRequestException("storeId is required for branch managers");
    }

    if (nextStoreId) {
      await this.assertActiveStore(nextStoreId, existing.organizationId);
    }

    const email =
      dto.email !== undefined ? dto.email.trim().toLowerCase() : existing.email;

    if (email !== existing.email) {
      await this.assertUniqueEmail(email, id);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
          ...(dto.email !== undefined ? { email } : undefined),
          ...(dto.role !== undefined ? { role: dto.role } : undefined),
          ...(hasStoreIdField || dto.role !== undefined
            ? { storeId: nextStoreId }
            : undefined),
          ...(dto.phone !== undefined
            ? { phone: dto.phone?.trim() || null }
            : undefined),
        },
        include: {
          store: { select: { id: true, name: true } },
        },
      });

      if (dto.password) {
        const hashedPassword = await hashPassword(dto.password);
        await tx.account.updateMany({
          where: { userId: id, providerId: "credential" },
          data: { password: hashedPassword },
        });
      }

      return updated;
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: requireOrganizationId(actor),
        action: AuditAction.USER_UPDATED,
        entityType: "user",
        entityId: user.id,
        oldValue: this.toAuditSnapshot(existing),
        newValue: this.toAuditSnapshot(user),
      },
    });

    return user;
  }

  async deactivate(id: string, actor: CurrentUserPayload): Promise<void> {
    if (id === actor.id) {
      throw new BadRequestException("You cannot deactivate your own account");
    }

    const existing = await this.findOne(id);

    if (!existing.isActive) {
      throw new BadRequestException("User is already inactive");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { isActive: false },
      });
      await tx.session.deleteMany({ where: { userId: id } });
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: requireOrganizationId(actor),
        action: AuditAction.USER_DEACTIVATED,
        entityType: "user",
        entityId: id,
        oldValue: this.toAuditSnapshot(existing),
        newValue: this.toAuditSnapshot({ ...existing, isActive: false }),
      },
    });
  }

  async activate(id: string, actor: CurrentUserPayload): Promise<SafeUser> {
    const existing = await this.findOne(id);

    if (existing.isActive) {
      throw new BadRequestException("User is already active");
    }

    if (existing.role === UserRole.branch_manager && existing.storeId) {
      await this.assertActiveStore(existing.storeId, existing.organizationId);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      include: {
        store: { select: { id: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: requireOrganizationId(actor),
        action: AuditAction.USER_REACTIVATED,
        entityType: "user",
        entityId: id,
        oldValue: this.toAuditSnapshot(existing),
        newValue: this.toAuditSnapshot(user),
      },
    });

    return user;
  }

  private resolveStoreIdForRole(
    role: UserRole,
    storeId?: string | null,
  ): string | null {
    const trimmed =
      typeof storeId === "string" ? storeId.trim() : (storeId ?? "");

    if (role === UserRole.super_admin || role === UserRole.admin) {
      if (trimmed) {
        throw new BadRequestException(
          `storeId is not allowed for ${role} users`,
        );
      }
      return null;
    }

    if (!trimmed) {
      throw new BadRequestException("storeId is required for branch managers");
    }

    return trimmed;
  }

  private async assertActiveStore(
    storeId: string,
    organizationId?: string | null,
  ): Promise<void> {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        isActive: true,
        ...(organizationId ? { organizationId } : undefined),
      },
    });

    if (!store) {
      throw new NotFoundException(`Store with id "${storeId}" not found`);
    }
  }

  private async assertUniqueEmail(
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: {
        email,
        ...(excludeUserId ? { id: { not: excludeUserId } } : undefined),
      },
      select: { email: true },
    });

    if (existing) {
      throw new ConflictException(
        `A user with email "${email}" already exists`,
      );
    }
  }

  private toAuditSnapshot(user: User | SafeUser): Prisma.InputJsonValue {
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
