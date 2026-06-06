import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { PaginatedResult, StoresService } from "../stores/stores.service";
import { InventoryQueryDto } from "./dto/inventory-query.dto";

export type InventoryWithDetails = Prisma.InventoryGetPayload<{
  include: {
    product: { include: { category: true } };
    store: true;
  };
}>;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly productsService: ProductsService,
  ) {}

  async findByStore(
    storeId: string,
    query: InventoryQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<InventoryWithDetails>> {
    this.assertStoreAccess(storeId, user);
    await this.storesService.findOne(storeId);

    const { page, limit, search, categoryId, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const productFilter: Prisma.ProductWhereInput = {
      isActive: true,
      ...(categoryId ? { categoryId } : undefined),
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : undefined),
    };

    let lowStockFilter: Prisma.InventoryWhereInput = {};
    if (lowStockOnly) {
      const lowStockRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM inventory
        WHERE "storeId" = ${storeId}
        AND quantity <= "lowStockThreshold"
      `;

      if (lowStockRows.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      lowStockFilter = { id: { in: lowStockRows.map((row) => row.id) } };
    }

    const where: Prisma.InventoryWhereInput = {
      storeId,
      store: { isActive: true },
      product: productFilter,
      ...lowStockFilter,
    };

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ product: { name: "asc" } }, { updatedAt: "desc" }],
        include: {
          product: { include: { category: true } },
          store: true,
        },
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
    this.assertStoreAccess(storeId, user);
    const [store, product] = await Promise.all([
      this.storesService.findOne(storeId),
      this.productsService.findOne(productId),
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

  private assertStoreAccess(storeId: string, user: CurrentUserPayload): void {
    if (user.role !== UserRole.branch_manager) {
      return;
    }

    if (!user.storeId) {
      throw new ForbiddenException("No store assigned to your account");
    }

    if (user.storeId !== storeId) {
      throw new ForbiddenException("You can only access your assigned store");
    }
  }
}
