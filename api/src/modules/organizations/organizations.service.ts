import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Organization, Prisma, UserRole } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { StoresService } from "../stores/stores.service";
import { UsersService } from "../users/users.service";
import { PaginatedResult } from "../stores/stores.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationQueryDto } from "./dto/organization-query.dto";
import { OrganizationUsersQueryDto } from "./dto/organization-users-query.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { UpdateOrganizationUserDto } from "./dto/update-organization-user.dto";

export type OrganizationDetail = Organization & {
  _count: { users: number; stores: number };
};

export type OrganizationUserRow = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    role: true;
    phone: true;
    isActive: true;
    store: { select: { id: true; name: true } };
  };
}>;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly usersService: UsersService,
  ) {}

  async findAll(
    query: OrganizationQueryDto,
  ): Promise<PaginatedResult<Organization>> {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = search
      ? { name: { contains: search, mode: "insensitive" } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.organization.count({ where }),
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

  async findOne(id: string): Promise<OrganizationDetail> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, stores: true } },
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with id "${id}" not found`);
    }

    return organization;
  }

  async findUsers(
    id: string,
    query: OrganizationUsersQueryDto,
  ): Promise<PaginatedResult<OrganizationUserRow>> {
    await this.findOne(id);

    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      organizationId: id,
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
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          isActive: true,
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

  async updateUser(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationUserDto,
    actor: CurrentUserPayload,
  ) {
    await this.assertOrgAdminUser(organizationId, userId);
    return this.usersService.update(userId, dto, actor);
  }

  async deactivateUser(
    organizationId: string,
    userId: string,
    actor: CurrentUserPayload,
  ): Promise<void> {
    await this.assertOrgAdminUser(organizationId, userId);
    return this.usersService.deactivate(userId, actor);
  }

  async activateUser(
    organizationId: string,
    userId: string,
    actor: CurrentUserPayload,
  ) {
    await this.assertOrgAdminUser(organizationId, userId);
    return this.usersService.activate(userId, actor);
  }

  private async assertOrgAdminUser(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await this.findOne(organizationId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    if (user.organizationId !== organizationId) {
      throw new NotFoundException(`User with id "${userId}" not found`);
    }

    if (user.role !== UserRole.admin) {
      throw new BadRequestException(
        "Only organization admins can be managed from this endpoint",
      );
    }
  }

  async create(
    dto: CreateOrganizationDto,
    actor: CurrentUserPayload,
  ): Promise<Organization> {
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        hasStores: dto.hasStores ?? true,
      },
    });

    await this.storesService.ensureOrgWarehouse(organization.id);

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: organization.id,
        action: AuditAction.ORGANIZATION_CREATED,
        entityType: "organization",
        entityId: organization.id,
        oldValue: Prisma.JsonNull,
        newValue: organization,
      },
    });

    return organization;
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    actor: CurrentUserPayload,
  ): Promise<Organization> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);

    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
        ...(dto.hasStores !== undefined ? { hasStores: dto.hasStores } : undefined),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : undefined),
      },
    });

    if (dto.hasStores === false) {
      await this.storesService.ensureOrgWarehouse(organization.id);
    }

    let action: AuditAction = AuditAction.ORGANIZATION_UPDATED;
    if (dto.isActive === false && existing.isActive) {
      action = AuditAction.ORGANIZATION_DEACTIVATED;
    } else if (dto.isActive === true && !existing.isActive) {
      action = AuditAction.ORGANIZATION_REACTIVATED;
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        organizationId: organization.id,
        action,
        entityType: "organization",
        entityId: organization.id,
        oldValue: existing,
        newValue: organization,
      },
    });

    return organization;
  }

  async findCurrent(user: CurrentUserPayload): Promise<OrganizationDetail> {
    const id = requireOrganizationId(user);
    return this.findOne(id);
  }

  async updateCurrent(
    user: CurrentUserPayload,
    dto: { name?: string },
  ): Promise<Organization> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const id = requireOrganizationId(user);
    const existing = await this.findOne(id);

    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        action: AuditAction.ORGANIZATION_UPDATED,
        entityType: "organization",
        entityId: organization.id,
        oldValue: existing,
        newValue: organization,
      },
    });

    return organization;
  }

  async getPlatformStats(): Promise<{ organizationCount: number; userCount: number }> {
    const [organizationCount, userCount] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count({
        where: { role: { not: "super_admin" } },
      }),
    ]);

    return { organizationCount, userCount };
  }
}
