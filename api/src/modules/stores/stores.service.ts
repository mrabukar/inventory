/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, Store, UserRole } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  ORG_WAREHOUSE_STORE_ADDRESS,
  ORG_WAREHOUSE_STORE_NAME,
} from "../../common/utils/org-warehouse.constants";
import { orderByUpdatedAtDesc } from "../../common/utils/list-order.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateStoreDto } from "./dto/create-store.dto";
import { StoreQueryDto } from "./dto/store-query.dto";
import { UpdateStoreDto } from "./dto/update-store.dto";

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: StoreQueryDto): Promise<PaginatedResult<Store>> {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = {
      isActive: true,
      isOrgWarehouse: false,
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : undefined),
    };

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByUpdatedAtDesc,
      }),
      this.prisma.store.count({ where }),
    ]);

    return {
      data: stores,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Store> {
    const store = await this.prisma.store.findFirst({
      where: { id, isActive: true },
    });

    if (!store) {
      throw new NotFoundException(`Store with id "${id}" not found`);
    }

    return store;
  }

  async create(dto: CreateStoreDto, user: CurrentUserPayload): Promise<Store> {
    const organizationId = requireOrganizationId(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { hasStores: true },
    });

    if (!org?.hasStores) {
      throw new BadRequestException(
        "This organization does not use stores. Stock is tracked at organization level.",
      );
    }

    await this.assertUniqueName(dto.name);

    const store = await this.prisma.store.create({
      data: withOrganizationId(dto, organizationId),
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId,
        action: "STORE_CREATED",
        entityType: "store",
        entityId: store.id,
        oldValue: Prisma.JsonNull,
        newValue: store,
      },
    });

    return store;
  }

  async update(
    id: string,
    dto: UpdateStoreDto,
    user: CurrentUserPayload,
  ): Promise<Store> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);

    if (dto.name && dto.name !== existing.name) {
      await this.assertUniqueName(dto.name, id);
    }

    const store = await this.prisma.store.update({
      where: { id },
      data: dto,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: requireOrganizationId(user),
        action: "STORE_UPDATED",
        entityType: "store",
        entityId: store.id,
        oldValue: existing,
        newValue: store,
      },
    });

    return store;
  }

  async deactivate(id: string, user: CurrentUserPayload): Promise<void> {
    const existing = await this.findOne(id);

    if (existing.isOrgWarehouse) {
      throw new BadRequestException(
        "The organization stock location cannot be deactivated",
      );
    }

    const assignedManagers = await this.prisma.user.findMany({
      where: {
        storeId: id,
        isActive: true,
        role: UserRole.branch_manager,
      },
      select: { id: true, name: true, email: true },
    });

    if (assignedManagers.length > 0) {
      throw new BadRequestException(
        `Cannot deactivate store: ${assignedManagers.length} active store manager(s) still assigned. Reassign or deactivate them first.`,
      );
    }

    const stockSummary = await this.prisma.inventory.aggregate({
      where: { storeId: id, quantity: { gt: 0 } },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    if (stockSummary._count._all > 0) {
      throw new BadRequestException(
        `Cannot deactivate store: ${stockSummary._sum.quantity ?? 0} unit(s) remain across ${stockSummary._count._all} product(s). Clear stock first.`,
      );
    }

    await this.prisma.store.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: requireOrganizationId(user),
        action: "STORE_DEACTIVATED",
        entityType: "store",
        entityId: id,
        oldValue: existing,
        newValue: { ...existing, isActive: false },
      },
    });
  }

  async reactivate(id: string, user: CurrentUserPayload): Promise<Store> {
    const existing = await this.prisma.store.findFirst({
      where: { id, isActive: false },
    });

    if (!existing) {
      throw new NotFoundException(`Inactive store with id "${id}" not found`);
    }

    await this.assertUniqueName(existing.name, id);

    const store = await this.prisma.store.update({
      where: { id },
      data: { isActive: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: requireOrganizationId(user),
        action: "STORE_REACTIVATED",
        entityType: "store",
        entityId: id,
        oldValue: existing,
        newValue: store,
      },
    });

    return store;
  }

  private async assertUniqueName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.store.findFirst({
      where: {
        name,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : undefined),
      },
    });

    if (existing) {
      throw new ConflictException(`A store named "${name}" already exists`);
    }
  }

  /** Hidden store used for org-level inventory when hasStores is false. */
  async ensureOrgWarehouse(organizationId: string): Promise<Store> {
    const existing = await this.prisma.store.findFirst({
      where: { organizationId, isOrgWarehouse: true },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.store.create({
      data: {
        organizationId,
        name: ORG_WAREHOUSE_STORE_NAME,
        address: ORG_WAREHOUSE_STORE_ADDRESS,
        isOrgWarehouse: true,
        isActive: true,
      },
    });
  }
}
