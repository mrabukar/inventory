import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, PurchaseType } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  parseDateColumnRangeEnd,
  parseDateColumnRangeStart,
} from "../../common/utils/app-timezone.util";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import { lockInventoryForMutation } from "../../common/utils/inventory-lock.util";
import { orderByCreatedAtDesc } from "../../common/utils/list-order.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { assertSellingPriceNotBelowPurchase } from "../products/product-price.util";
import { ProductsService } from "../products/products.service";
import { PaginatedResult, StoresService } from "../stores/stores.service";
import { CorrectPurchaseDto } from "./dto/correct-purchase.dto";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { PurchaseQueryDto } from "./dto/purchase-query.dto";
import { parseAndValidatePurchaseDate } from "./purchase-date.util";
import {
  computeWeightedAverageCost,
  reverseWeightedAverageCost,
} from "./weighted-average.util";

const purchaseInclude = {
  product: { include: { category: true } },
  purchasedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PurchaseInclude;

export type PurchaseWithDetails = Prisma.PurchaseGetPayload<{
  include: typeof purchaseInclude;
}>;

export type PurchaseListItem = PurchaseWithDetails & {
  reversibleQuantity: number;
};

export type PurchaseCreateResult = PurchaseWithDetails & {
  product: PurchaseWithDetails["product"] & {
    averageCost: Prisma.Decimal;
    sellingPrice: Prisma.Decimal;
  };
};

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storesService: StoresService,
    private readonly productsService: ProductsService,
  ) {}

  async findAll(
    query: PurchaseQueryDto,
  ): Promise<PaginatedResult<PurchaseListItem>> {
    const { page, limit, productId, invoiceNumber } = query;
    const skip = (page - 1) * limit;
    const searchTerm =
      typeof query.search === "string" ? query.search.trim() : "";
    const fromDate =
      typeof query.fromDate === "string" ? query.fromDate.trim() : "";
    const toDate = typeof query.toDate === "string" ? query.toDate.trim() : "";

    const where: Prisma.PurchaseWhereInput = {
      ...(productId ? { productId } : undefined),
      ...(invoiceNumber
        ? {
            invoiceNumber: {
              contains: invoiceNumber,
              mode: "insensitive",
            },
          }
        : undefined),
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
            purchaseDate: {
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

    const [rows, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderByCreatedAtDesc,
        include: purchaseInclude,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    const data = await this.attachReversibleQuantities(rows);

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

  async findByProduct(
    productId: string,
    query: PurchaseQueryDto,
  ): Promise<PaginatedResult<PurchaseListItem>> {
    await this.productsService.findOneIncludingInactive(productId);
    return this.findAll({ ...query, productId });
  }

  async create(
    dto: CreatePurchaseDto,
    user: CurrentUserPayload,
  ): Promise<PurchaseCreateResult> {
    const product = await this.productsService.findOne(dto.productId);
    const purchaseDate = parseAndValidatePurchaseDate(dto.purchaseDate);
    const unitPurchasePrice = toMoneyNumber(dto.unitPurchasePrice);
    const totalCost = toMoneyNumber(unitPurchasePrice * dto.quantity);

    const organizationId = requireOrganizationId(user);
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);

    const sellingPrice =
      dto.newSellingPrice !== undefined
        ? toMoneyNumber(dto.newSellingPrice)
        : Number(product.sellingPrice);

    if (dto.newSellingPrice !== undefined && !dto.acceptSellingBelowCost) {
      assertSellingPriceNotBelowPurchase(unitPurchasePrice, sellingPrice);
    }

    const purchaseId = await this.prisma.$transaction(async (tx) => {
      const inventory = await lockInventoryForMutation(
        tx,
        organizationId,
        dto.productId,
        warehouse.id,
      );

      const onHandAgg = await tx.inventory.aggregate({
        where: { productId: dto.productId, organizationId },
        _sum: { quantity: true },
      });
      const onHand = onHandAgg._sum.quantity ?? 0;
      // Re-read the average inside the lock — a concurrent purchase may have
      // updated it after the pre-transaction product fetch.
      const { averageCost: lockedAverageCost } =
        await tx.product.findUniqueOrThrow({
          where: { id: dto.productId },
          select: { averageCost: true },
        });
      const currentAverage = Number(lockedAverageCost);
      const newAverage = computeWeightedAverageCost(
        onHand,
        currentAverage,
        dto.quantity,
        unitPurchasePrice,
      );

      const purchase = await tx.purchase.create({
        data: withOrganizationId(
          {
            productId: dto.productId,
            quantity: dto.quantity,
            unitPurchasePrice,
            totalCost,
            purchaseDate,
            invoiceNumber: dto.invoiceNumber?.trim() || null,
            note: dto.note?.trim() || null,
            purchasedById: user.id,
          },
          organizationId,
        ),
      });

      const previousQty = inventory?.quantity ?? 0;
      const newQty = previousQty + dto.quantity;

      const updatedInventory = inventory
        ? await tx.inventory.update({
            where: {
              productId_storeId: {
                productId: dto.productId,
                storeId: warehouse.id,
              },
            },
            data: { quantity: newQty },
          })
        : await tx.inventory.create({
            data: withOrganizationId(
              {
                productId: dto.productId,
                storeId: warehouse.id,
                quantity: newQty,
              },
              organizationId,
            ),
          });

      const updatedProduct = await tx.product.update({
        where: { id: dto.productId },
        data: {
          averageCost: newAverage,
          ...(dto.newSellingPrice !== undefined
            ? { sellingPrice }
            : undefined),
        },
        include: { category: true },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: AuditAction.PURCHASE_CREATED,
          entityType: "purchase",
          entityId: purchase.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            id: purchase.id,
            productId: dto.productId,
            productName: product.name,
            quantity: dto.quantity,
            unitPurchasePrice,
            totalCost,
            purchaseDate,
            invoiceNumber: dto.invoiceNumber ?? null,
            previousAverageCost: currentAverage,
            newAverageCost: newAverage,
            ...(dto.newSellingPrice !== undefined
              ? { newSellingPrice: sellingPrice }
              : undefined),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          organizationId,
          action: AuditAction.INVENTORY_UPDATED,
          entityType: "inventory",
          entityId: updatedInventory.id,
          oldValue: {
            quantity: previousQty,
            productId: dto.productId,
            storeId: warehouse.id,
          },
          newValue: {
            quantity: newQty,
            productId: dto.productId,
            storeId: warehouse.id,
          },
        },
      });

      if (newAverage !== currentAverage) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            organizationId,
            action: AuditAction.PRODUCT_COST_RECALCULATED,
            entityType: "product",
            entityId: dto.productId,
            oldValue: { averageCost: currentAverage },
            newValue: { averageCost: newAverage },
          },
        });
      }

      return purchase.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    const purchase = await this.prisma.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: purchaseInclude,
    });

    const updatedProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: dto.productId },
      include: { category: true },
    });

    return {
      ...purchase,
      product: updatedProduct,
    };
  }

  /**
   * @deprecated Use {@link correctSubtract} — kept for backward compatibility.
   */
  async correct(
    purchaseId: string,
    dto: CorrectPurchaseDto,
    user: CurrentUserPayload,
  ): Promise<PurchaseCreateResult> {
    return this.correctSubtract(purchaseId, dto, user);
  }

  /**
   * Record units that were bought but under-counted on the original purchase.
   */
  async correctAdd(
    purchaseId: string,
    dto: CorrectPurchaseDto,
    user: CurrentUserPayload,
  ): Promise<PurchaseCreateResult> {
    const organizationId = requireOrganizationId(user);
    const original = await this.loadCorrectablePurchase(purchaseId);
    const productId = original.productId;
    const originalUnitCost = Number(original.unitPurchasePrice);
    const addValue = toMoneyNumber(originalUnitCost * dto.quantity);
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);
    const reason = dto.reason.trim();

    const correctionId = await this.prisma.$transaction(async (tx) => {
      const warehouseInventory = await lockInventoryForMutation(
        tx,
        organizationId,
        productId,
        warehouse.id,
      );
      const warehouseQty = warehouseInventory?.quantity ?? 0;

      const onHandAgg = await tx.inventory.aggregate({
        where: { productId, organizationId },
        _sum: { quantity: true },
      });
      const onHand = onHandAgg._sum.quantity ?? 0;

      const { averageCost: lockedAverageCost } =
        await tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: { averageCost: true },
        });
      const currentAverage = Number(lockedAverageCost);
      const newAverage = computeWeightedAverageCost(
        onHand,
        currentAverage,
        dto.quantity,
        originalUnitCost,
      );

      const correction = await tx.purchase.create({
        data: withOrganizationId(
          {
            productId,
            quantity: dto.quantity,
            unitPurchasePrice: originalUnitCost,
            totalCost: addValue,
            type: PurchaseType.correction,
            correctsPurchaseId: purchaseId,
            invoiceNumber: original.invoiceNumber,
            purchaseDate: original.purchaseDate,
            note: reason,
            purchasedById: user.id,
          },
          organizationId,
        ),
      });

      const newWarehouseQty = warehouseQty + dto.quantity;
      const updatedInventory = warehouseInventory
        ? await tx.inventory.update({
            where: { productId_storeId: { productId, storeId: warehouse.id } },
            data: { quantity: newWarehouseQty },
          })
        : await tx.inventory.create({
            data: withOrganizationId(
              {
                productId,
                storeId: warehouse.id,
                quantity: newWarehouseQty,
              },
              organizationId,
            ),
          });

      await tx.product.update({
        where: { id: productId },
        data: { averageCost: newAverage },
      });

      await this.writeCorrectionAuditLogs(tx, {
        userId: user.id,
        organizationId,
        correction,
        original,
        purchaseId,
        productId,
        quantity: dto.quantity,
        direction: "add",
        unitPurchasePrice: originalUnitCost,
        totalCost: addValue,
        reason,
        currentAverage,
        newAverage,
        warehouseQty,
        newWarehouseQty,
        warehouseId: warehouse.id,
        updatedInventoryId: updatedInventory.id,
      });

      return correction.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.loadCorrectionResult(correctionId, productId);
  }

  /**
   * Remove units that were over-counted on the original purchase.
   */
  async correctSubtract(
    purchaseId: string,
    dto: CorrectPurchaseDto,
    user: CurrentUserPayload,
  ): Promise<PurchaseCreateResult> {
    const organizationId = requireOrganizationId(user);
    const original = await this.loadCorrectablePurchase(purchaseId);
    const removable = await this.getRemovableQuantity(
      purchaseId,
      original.quantity,
    );
    if (dto.quantity > removable) {
      throw new BadRequestException(
        `Cannot remove ${dto.quantity} units: only ${removable} remain on this purchase after prior corrections`,
      );
    }

    const productId = original.productId;
    const originalUnitCost = Number(original.unitPurchasePrice);
    const reverseValue = toMoneyNumber(originalUnitCost * dto.quantity);
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);
    const reason = dto.reason.trim();

    const correctionId = await this.prisma.$transaction(async (tx) => {
      const warehouseInventory = await lockInventoryForMutation(
        tx,
        organizationId,
        productId,
        warehouse.id,
      );
      const warehouseQty = warehouseInventory?.quantity ?? 0;
      if (warehouseQty < dto.quantity) {
        throw new BadRequestException(
          `Cannot remove ${dto.quantity} units: only ${warehouseQty} are in the warehouse. Units already distributed or sold must be returned first.`,
        );
      }

      const onHandAgg = await tx.inventory.aggregate({
        where: { productId, organizationId },
        _sum: { quantity: true },
      });
      const onHand = onHandAgg._sum.quantity ?? 0;

      const { averageCost: lockedAverageCost } =
        await tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: { averageCost: true },
        });
      const currentAverage = Number(lockedAverageCost);
      const newAverage = reverseWeightedAverageCost(
        onHand,
        currentAverage,
        dto.quantity,
        originalUnitCost,
      );

      const correction = await tx.purchase.create({
        data: withOrganizationId(
          {
            productId,
            quantity: -dto.quantity,
            unitPurchasePrice: originalUnitCost,
            totalCost: -reverseValue,
            type: PurchaseType.correction,
            correctsPurchaseId: purchaseId,
            invoiceNumber: original.invoiceNumber,
            // Date the reversal to the original purchase so period reports reconcile.
            purchaseDate: original.purchaseDate,
            note: reason,
            purchasedById: user.id,
          },
          organizationId,
        ),
      });

      const newWarehouseQty = warehouseQty - dto.quantity;
      const updatedInventory = await tx.inventory.update({
        where: { productId_storeId: { productId, storeId: warehouse.id } },
        data: { quantity: newWarehouseQty },
      });

      await tx.product.update({
        where: { id: productId },
        data: { averageCost: newAverage },
      });

      await this.writeCorrectionAuditLogs(tx, {
        userId: user.id,
        organizationId,
        correction,
        original,
        purchaseId,
        productId,
        quantity: dto.quantity,
        direction: "subtract",
        unitPurchasePrice: originalUnitCost,
        totalCost: -reverseValue,
        reason,
        currentAverage,
        newAverage,
        warehouseQty,
        newWarehouseQty,
        warehouseId: warehouse.id,
        updatedInventoryId: updatedInventory.id,
      });

      return correction.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.loadCorrectionResult(correctionId, productId);
  }

  private async loadCorrectablePurchase(
    purchaseId: string,
  ): Promise<PurchaseWithDetails> {
    const original = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: purchaseInclude,
    });
    if (!original) {
      throw new NotFoundException(`Purchase with id "${purchaseId}" not found`);
    }
    if (original.type !== PurchaseType.purchase) {
      throw new BadRequestException("Only purchases can be corrected");
    }
    return original;
  }

  private async getNetCorrectionQuantity(purchaseId: string): Promise<number> {
    const priorAgg = await this.prisma.purchase.aggregate({
      where: {
        correctsPurchaseId: purchaseId,
        type: PurchaseType.correction,
      },
      _sum: { quantity: true },
    });
    return priorAgg._sum.quantity ?? 0;
  }

  private async getRemovableQuantity(
    purchaseId: string,
    originalQuantity: number,
  ): Promise<number> {
    const netCorrection = await this.getNetCorrectionQuantity(purchaseId);
    return Math.max(0, originalQuantity + netCorrection);
  }

  private async loadCorrectionResult(
    correctionId: string,
    productId: string,
  ): Promise<PurchaseCreateResult> {
    const correction = await this.prisma.purchase.findUniqueOrThrow({
      where: { id: correctionId },
      include: purchaseInclude,
    });
    const updatedProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { category: true },
    });

    return { ...correction, product: updatedProduct };
  }

  private async writeCorrectionAuditLogs(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      organizationId: string;
      correction: { id: string };
      original: PurchaseWithDetails;
      purchaseId: string;
      productId: string;
      quantity: number;
      direction: "add" | "subtract";
      unitPurchasePrice: number;
      totalCost: number;
      reason: string;
      currentAverage: number;
      newAverage: number;
      warehouseQty: number;
      newWarehouseQty: number;
      warehouseId: string;
      updatedInventoryId: string;
    },
  ): Promise<void> {
    const {
      userId,
      organizationId,
      correction,
      original,
      purchaseId,
      productId,
      quantity,
      direction,
      unitPurchasePrice,
      totalCost,
      reason,
      currentAverage,
      newAverage,
      warehouseQty,
      newWarehouseQty,
      warehouseId,
      updatedInventoryId,
    } = input;

    await tx.auditLog.create({
      data: {
        userId,
        organizationId,
        action: AuditAction.PURCHASE_CORRECTED,
        entityType: "purchase",
        entityId: correction.id,
        oldValue: Prisma.JsonNull,
        newValue: {
          id: correction.id,
          correctsPurchaseId: purchaseId,
          productId,
          productName: original.product.name,
          direction,
          correctedQuantity: quantity,
          unitPurchasePrice,
          totalCost,
          reason,
          previousAverageCost: currentAverage,
          newAverageCost: newAverage,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        organizationId,
        action: AuditAction.INVENTORY_UPDATED,
        entityType: "inventory",
        entityId: updatedInventoryId,
        oldValue: {
          quantity: warehouseQty,
          productId,
          storeId: warehouseId,
        },
        newValue: {
          quantity: newWarehouseQty,
          productId,
          storeId: warehouseId,
        },
      },
    });

    if (newAverage !== currentAverage) {
      await tx.auditLog.create({
        data: {
          userId,
          organizationId,
          action: AuditAction.PRODUCT_COST_RECALCULATED,
          entityType: "product",
          entityId: productId,
          oldValue: { averageCost: currentAverage },
          newValue: { averageCost: newAverage },
        },
      });
    }
  }

  private async attachReversibleQuantities(
    purchases: PurchaseWithDetails[],
  ): Promise<PurchaseListItem[]> {
    const purchaseIds = purchases
      .filter((row) => row.type === PurchaseType.purchase)
      .map((row) => row.id);

    const netCorrectionByPurchase = new Map<string, number>();
    if (purchaseIds.length > 0) {
      const priorCorrections = await this.prisma.purchase.groupBy({
        by: ["correctsPurchaseId"],
        where: {
          correctsPurchaseId: { in: purchaseIds },
          type: PurchaseType.correction,
        },
        _sum: { quantity: true },
      });

      for (const row of priorCorrections) {
        if (!row.correctsPurchaseId) continue;
        netCorrectionByPurchase.set(
          row.correctsPurchaseId,
          row._sum.quantity ?? 0,
        );
      }
    }

    return purchases.map((purchase) => {
      if (purchase.type !== PurchaseType.purchase) {
        return { ...purchase, reversibleQuantity: 0 };
      }

      const netCorrection = netCorrectionByPurchase.get(purchase.id) ?? 0;
      return {
        ...purchase,
        reversibleQuantity: Math.max(0, purchase.quantity + netCorrection),
      };
    });
  }
}
