import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  parseDateColumnRangeEnd,
  parseDateColumnRangeStart,
} from "../../common/utils/app-timezone.util";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import { lockInventoryForMutation } from "../../common/utils/inventory-lock.util";
import { orderByCreatedAtDesc } from "../../common/utils/list-order.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { productUnitCost } from "../../common/utils/product-unit-cost.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { TenantStoreResolver } from "../../common/tenant/tenant-store-resolver.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { PaginatedResult, StoresService } from "../stores/stores.service";
import { CreateStockCorrectionDto } from "./dto/create-stock-correction.dto";
import { CreateStockSupplyDto } from "./dto/create-stock-supply.dto";
import { StockSupplyQueryDto } from "./dto/stock-supply-query.dto";
import type { StockSupplyTypeValue } from "./stock-supply.constants";

const stockSupplyInclude = {
  product: { include: { category: true } },
  store: true,
  suppliedBy: { select: { id: true, name: true, email: true } },
  correctsSupply: {
    select: { id: true, type: true, quantity: true, createdAt: true },
  },
} satisfies Prisma.StockSupplyInclude;

export type StockSupplyWithDetails = Prisma.StockSupplyGetPayload<{
  include: typeof stockSupplyInclude;
}>;

interface RecordStockChangeInput {
  productId: string;
  storeId?: string;
  signedQuantity: number;
  note?: string;
  correctsSupplyId?: string;
  type: StockSupplyTypeValue;
}

@Injectable()
export class StockSuppliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly productsService: ProductsService,
    private readonly tenantStoreResolver: TenantStoreResolver,
  ) {}

  async findAll(
    query: StockSupplyQueryDto,
  ): Promise<PaginatedResult<StockSupplyWithDetails>> {
    const { page, limit, storeId, productId } = query;
    const skip = (page - 1) * limit;
    const searchTerm =
      typeof query.search === "string" ? query.search.trim() : "";
    const fromDate =
      typeof query.fromDate === "string" ? query.fromDate.trim() : "";
    const toDate = typeof query.toDate === "string" ? query.toDate.trim() : "";

    const where: Prisma.StockSupplyWhereInput = {
      ...(storeId ? { storeId } : undefined),
      ...(productId ? { productId } : undefined),
      ...(query.type ? { type: query.type } : undefined),
      ...(query.categoryId || searchTerm
        ? {
            product: {
              ...(query.categoryId
                ? { categoryId: query.categoryId }
                : undefined),
              ...(searchTerm
                ? { name: { contains: searchTerm, mode: "insensitive" } }
                : undefined),
            },
          }
        : undefined),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate
                ? { gte: parseDateColumnRangeStart(fromDate) }
                : undefined),
              ...(toDate
                ? { lte: parseDateColumnRangeEnd(toDate) }
                : undefined),
            },
          }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockSupply.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByCreatedAtDesc,
        include: stockSupplyInclude,
      }),
      this.prisma.stockSupply.count({ where }),
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

  async create(
    dto: CreateStockSupplyDto,
    user: CurrentUserPayload,
  ): Promise<StockSupplyWithDetails> {
    await this.assertDistributionAllowed(user);

    return this.recordStockChange(
      {
        productId: dto.productId,
        storeId: dto.storeId,
        signedQuantity: dto.quantity,
        note: dto.note,
        type: "supply",
      },
      user,
    );
  }

  async correctionAdd(
    dto: CreateStockCorrectionDto,
    user: CurrentUserPayload,
  ): Promise<StockSupplyWithDetails> {
    await this.assertDistributionAllowed(user);

    return this.recordStockChange(
      {
        productId: dto.productId,
        storeId: dto.storeId,
        signedQuantity: dto.quantity,
        note: dto.note,
        correctsSupplyId: dto.correctsSupplyId,
        type: "correction_add",
      },
      user,
    );
  }

  async correctionSubtract(
    dto: CreateStockCorrectionDto,
    user: CurrentUserPayload,
  ): Promise<StockSupplyWithDetails> {
    await this.assertDistributionAllowed(user);

    return this.recordStockChange(
      {
        productId: dto.productId,
        storeId: dto.storeId,
        signedQuantity: -dto.quantity,
        note: dto.note,
        correctsSupplyId: dto.correctsSupplyId,
        type: "correction_subtract",
      },
      user,
      { allowInactiveProduct: true },
    );
  }

  private async assertDistributionAllowed(
    user: CurrentUserPayload,
  ): Promise<void> {
    const organizationId = requireOrganizationId(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { hasStores: true },
    });

    if (!org) {
      throw new ForbiddenException("Organization not found");
    }

    if (!org.hasStores) {
      throw new BadRequestException(
        "Distribution is not available for organizations without stores. Record purchases instead.",
      );
    }
  }

  private async recordStockChange(
    input: RecordStockChangeInput,
    user: CurrentUserPayload,
    options?: { allowInactiveProduct?: boolean },
  ): Promise<StockSupplyWithDetails> {
    const {
      productId,
      signedQuantity,
      note,
      correctsSupplyId,
      type,
    } = input;

    const storeId = await this.tenantStoreResolver.resolveMutationStoreId(
      user,
      input.storeId,
    );

    if (signedQuantity === 0) {
      throw new BadRequestException("Quantity must not be zero");
    }

    const organizationId = requireOrganizationId(user);
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);

    if (storeId === warehouse.id) {
      throw new BadRequestException(
        "Cannot distribute to the organization warehouse. Select a store.",
      );
    }

    const [, product] = await Promise.all([
      this.storesService.findOne(storeId),
      options?.allowInactiveProduct
        ? this.productsService.findOneIncludingInactive(productId)
        : this.productsService.findOne(productId),
      this.assertCorrectsSupply(correctsSupplyId, productId, storeId),
    ]);

    const referencePrice = productUnitCost(product);

    const supplyId = await this.prisma.$transaction(async (tx) => {
      const warehouseInventory = await lockInventoryForMutation(
        tx,
        organizationId,
        productId,
        warehouse.id,
      );
      const storeInventory = await lockInventoryForMutation(
        tx,
        organizationId,
        productId,
        storeId,
      );

      const warehouseQty = warehouseInventory?.quantity ?? 0;
      const storeQty = storeInventory?.quantity ?? 0;

      if (signedQuantity > 0) {
        if (warehouseQty < signedQuantity) {
          throw new BadRequestException(
            `Insufficient warehouse stock: ${warehouseQty} available, ${signedQuantity} requested`,
          );
        }
      } else {
        const removeFromStore = Math.abs(signedQuantity);
        if (storeQty < removeFromStore) {
          throw new BadRequestException(
            `Insufficient store stock: ${storeQty} available, cannot remove ${removeFromStore} units`,
          );
        }
      }

      const newWarehouseQty = warehouseQty - signedQuantity;
      const newStoreQty = storeQty + signedQuantity;

      const stockSupply = await tx.stockSupply.create({
        data: withOrganizationId(
          {
            productId,
            storeId,
            quantity: signedQuantity,
            unitPurchasePrice: referencePrice,
            type,
            correctsSupplyId,
            suppliedById: user.id,
            note,
          },
          organizationId,
        ),
      });

      const updatedWarehouse = warehouseInventory
        ? await tx.inventory.update({
            where: {
              productId_storeId: { productId, storeId: warehouse.id },
            },
            data: { quantity: newWarehouseQty },
          })
        : await tx.inventory.create({
            data: withOrganizationId(
              { productId, storeId: warehouse.id, quantity: newWarehouseQty },
              organizationId,
            ),
          });

      const updatedStore = storeInventory
        ? await tx.inventory.update({
            where: { productId_storeId: { productId, storeId } },
            data: { quantity: newStoreQty },
          })
        : await tx.inventory.create({
            data: withOrganizationId(
              { productId, storeId, quantity: newStoreQty },
              organizationId,
            ),
          });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: "STOCK_SUPPLIED",
          entityType: "stock_supply",
          entityId: stockSupply.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            id: stockSupply.id,
            productId,
            storeId,
            warehouseId: warehouse.id,
            quantity: signedQuantity,
            unitPurchasePrice: referencePrice,
            type,
            correctsSupplyId,
            note,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: "INVENTORY_UPDATED",
          entityType: "inventory",
          entityId: updatedWarehouse.id,
          oldValue: {
            quantity: warehouseQty,
            productId,
            storeId: warehouse.id,
          },
          newValue: {
            quantity: newWarehouseQty,
            productId,
            storeId: warehouse.id,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: "INVENTORY_UPDATED",
          entityType: "inventory",
          entityId: updatedStore.id,
          oldValue: { quantity: storeQty, productId, storeId },
          newValue: {
            quantity: newStoreQty,
            productId,
            storeId,
          },
        },
      });

      return stockSupply.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.prisma.stockSupply.findUniqueOrThrow({
      where: { id: supplyId },
      include: stockSupplyInclude,
    });
  }

  private async assertCorrectsSupply(
    correctsSupplyId: string | undefined,
    productId: string,
    storeId: string,
  ): Promise<void> {
    if (!correctsSupplyId) {
      return;
    }

    const original = await this.prisma.stockSupply.findUnique({
      where: { id: correctsSupplyId },
    });

    if (!original) {
      throw new NotFoundException(
        `Supply with id "${correctsSupplyId}" not found`,
      );
    }

    if (original.productId !== productId || original.storeId !== storeId) {
      throw new BadRequestException(
        "Correction must reference the same product and store as the original supply",
      );
    }
  }
}
