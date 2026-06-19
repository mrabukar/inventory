import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { TenantStoreResolver } from "../../common/tenant/tenant-store-resolver.service";
import { assertStoreAccess } from "../../common/utils/store-scope.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { PaginatedResult, StoresService } from "../stores/stores.service";
import { InventoryAlertQueryDto } from "./dto/inventory-alert-query.dto";
import { InventoryQueryDto } from "./dto/inventory-query.dto";

export type InventoryWithDetails = Prisma.InventoryGetPayload<{
  include: {
    product: { include: { category: true } };
    store: true;
  };
}>;

const inventoryInclude = {
  product: { include: { category: true } },
  store: true,
} satisfies Prisma.InventoryInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly productsService: ProductsService,
    private readonly tenantStoreResolver: TenantStoreResolver,
  ) {}

  async findAll(
    query: InventoryQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InventoryWithDetails>> {
    const queryStoreId =
      typeof query.storeId === "string" ? query.storeId.trim() : undefined;
    if (queryStoreId) {
      assertStoreAccess(queryStoreId, user);
    }
    const storeId = await this.tenantStoreResolver.resolveStoreFilter(
      user,
      query.storeId,
    );
    if (storeId) {
      await this.storesService.findOne(storeId);
    }

    return this.listInventory(storeId, query, user);
  }

  async findByStore(
    storeId: string,
    query: InventoryQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InventoryWithDetails>> {
    assertStoreAccess(storeId, user);
    await this.storesService.findOne(storeId);

    return this.listInventory(storeId, query, user);
  }

  private async listInventory(
    storeId: string | undefined,
    query: InventoryQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InventoryWithDetails>> {
    const { page, limit, search, categoryId, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const lowStockFilter = await this.buildLowStockFilter(
      storeId,
      lowStockOnly,
      requireOrganizationId(user),
    );

    const where = this.buildInventoryWhere(
      storeId,
      user,
      { search, categoryId },
      lowStockFilter,
    );

    const orderBy: Prisma.InventoryOrderByWithRelationInput[] = storeId
      ? [{ product: { name: "asc" } }, { updatedAt: "desc" }]
      : [
          { store: { name: "asc" } },
          { product: { name: "asc" } },
          { updatedAt: "desc" },
        ];

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: inventoryInclude,
      }),
      this.prisma.inventory.count({ where }),
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

  async findOne(
    storeId: string,
    productId: string,
    user: CurrentUserPayload,
  ): Promise<InventoryWithDetails> {
    assertStoreAccess(storeId, user);
    const [store, product] = await Promise.all([
      this.storesService.findOne(storeId),
      user.role === UserRole.admin
        ? this.productsService.findOneIncludingInactive(productId)
        : this.productsService.findOne(productId),
    ]);

    const inventory = await this.prisma.inventory.findFirst({
      where: { storeId, productId },
      include: {
        product: { include: { category: true } },
        store: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException(
        // `No inventory found for product "${productId}" at store "${storeId}"`,
        `No inventory found for product "${product.name}" at store "${store.name}"`,
      );
    }

    return inventory;
  }

  async findLowStock(
    query: InventoryAlertQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InventoryWithDetails>> {
    return this.findStockAlerts("low", query, user);
  }

  async findOutOfStock(
    query: InventoryAlertQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InventoryWithDetails>> {
    return this.findStockAlerts("out", query, user);
  }

  async updateLowStockThreshold(
    storeId: string,
    productId: string,
    lowStockThreshold: number,
    user: CurrentUserPayload,
  ): Promise<InventoryWithDetails> {
    const [store, product] = await Promise.all([
      this.storesService.findOne(storeId),
      this.productsService.findOneIncludingInactive(productId),
    ]);

    const existing = await this.prisma.inventory.findFirst({
      where: { storeId, productId },
      include: {
        product: { include: { category: true } },
        store: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `No inventory found for product "${product.name}" at store "${store.name}"`,
      );
    }

    const updated = await this.prisma.inventory.update({
      where: { id: existing.id },
      data: { lowStockThreshold },
      include: {
        product: { include: { category: true } },
        store: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        organizationId: requireOrganizationId(user),
        action: AuditAction.INVENTORY_UPDATED,
        entityType: "inventory",
        entityId: updated.id,
        oldValue: {
          lowStockThreshold: existing.lowStockThreshold,
          productId,
          storeId,
        },
        newValue: {
          lowStockThreshold: updated.lowStockThreshold,
          productId,
          storeId,
        },
      },
    });

    return updated;
  }

  private buildProductSearchFilter(
    search?: string,
    categoryId?: number,
  ): Prisma.ProductWhereInput {
    return {
      ...(categoryId ? { categoryId } : undefined),
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : undefined),
    };
  }

  private buildInventoryWhere(
    storeId: string | undefined,
    user: CurrentUserPayload,
    filters: { search?: string; categoryId?: number },
    lowStockFilter: Prisma.InventoryWhereInput,
  ): Prisma.InventoryWhereInput {
    const productSearch = this.buildProductSearchFilter(
      filters.search,
      filters.categoryId,
    );
    const base: Prisma.InventoryWhereInput = {
      ...(storeId ? { storeId } : undefined),
      store: { isActive: true },
      ...lowStockFilter,
    };

    if (user.role === UserRole.admin) {
      return {
        ...base,
        OR: [
          { product: { isActive: true, ...productSearch } },
          {
            product: { isActive: false, ...productSearch },
            quantity: { gt: 0 },
          },
        ],
      };
    }

    return {
      ...base,
      product: { isActive: true, ...productSearch },
    };
  }

  private async buildLowStockFilter(
    storeId: string | undefined,
    lowStockOnly?: boolean,
    organizationId?: string,
  ): Promise<Prisma.InventoryWhereInput> {
    if (!lowStockOnly || !organizationId) {
      return {};
    }

    const lowStockRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM inventory
      WHERE quantity > 0
      AND quantity <= "lowStockThreshold"
      AND "organizationId" = ${organizationId}
      ${storeId ? Prisma.sql`AND "storeId" = ${storeId}` : Prisma.empty}
    `;

    if (lowStockRows.length === 0) {
      return { id: { in: [] } };
    }

    return { id: { in: lowStockRows.map((row) => row.id) } };
  }

  private async resolveAlertStoreId(
    user: CurrentUserPayload,
    queryStoreId?: string,
  ): Promise<string | undefined> {
    const trimmed =
      typeof queryStoreId === "string" ? queryStoreId.trim() : undefined;
    if (trimmed) {
      assertStoreAccess(trimmed, user);
    }
    return this.tenantStoreResolver.resolveStoreFilter(user, queryStoreId);
  }

  private async findStockAlerts(
    kind: "low" | "out",
    query: InventoryAlertQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InventoryWithDetails>> {
    const storeId = await this.resolveAlertStoreId(user, query.storeId);
    const search =
      typeof query.search === "string" ? query.search.trim() : undefined;
    const { page, limit, categoryId } = query;
    const skip = (page - 1) * limit;

    if (kind === "out") {
      const where = this.buildOutOfStockWhere(storeId, { search, categoryId });
      const [rows, total] = await Promise.all([
        this.prisma.inventory.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ product: { name: "asc" } }, { updatedAt: "desc" }],
          include: inventoryInclude,
        }),
        this.prisma.inventory.count({ where }),
      ]);

      return {
        data: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const organizationId = requireOrganizationId(user);
    const searchPattern = search ? `%${search}%` : null;
    const [countRows, idRows] = await Promise.all([
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "inventory" i
        INNER JOIN "product" p ON p.id = i."productId"
        INNER JOIN "store" st ON st.id = i."storeId"
        WHERE p."isActive" = true
          AND st."isActive" = true
          AND i."organizationId" = ${organizationId}
          AND i.quantity > 0
          AND i.quantity <= i."lowStockThreshold"
          ${storeId ? Prisma.sql`AND i."storeId" = ${storeId}` : Prisma.empty}
          ${categoryId ? Prisma.sql`AND p."categoryId" = ${categoryId}` : Prisma.empty}
          ${searchPattern ? Prisma.sql`AND p.name ILIKE ${searchPattern}` : Prisma.empty}
      `,
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT i.id
        FROM "inventory" i
        INNER JOIN "product" p ON p.id = i."productId"
        INNER JOIN "store" st ON st.id = i."storeId"
        WHERE p."isActive" = true
          AND st."isActive" = true
          AND i."organizationId" = ${organizationId}
          AND i.quantity > 0
          AND i.quantity <= i."lowStockThreshold"
          ${storeId ? Prisma.sql`AND i."storeId" = ${storeId}` : Prisma.empty}
          ${categoryId ? Prisma.sql`AND p."categoryId" = ${categoryId}` : Prisma.empty}
          ${searchPattern ? Prisma.sql`AND p.name ILIKE ${searchPattern}` : Prisma.empty}
        ORDER BY i.quantity ASC, p.name ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    const orderedIds = idRows.map((row) => row.id);

    if (orderedIds.length === 0) {
      return {
        data: [],
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const rows = await this.prisma.inventory.findMany({
      where: { id: { in: orderedIds } },
      include: inventoryInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    return {
      data: orderedIds
        .map((id) => byId.get(id))
        .filter((row): row is InventoryWithDetails => row !== undefined),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private buildOutOfStockWhere(
    storeId: string | undefined,
    filters: { search?: string; categoryId?: number },
  ): Prisma.InventoryWhereInput {
    const productSearch = this.buildProductSearchFilter(
      filters.search,
      filters.categoryId,
    );

    return {
      ...(storeId ? { storeId } : undefined),
      quantity: 0,
      product: { isActive: true, ...productSearch },
      store: { isActive: true },
    };
  }
}
