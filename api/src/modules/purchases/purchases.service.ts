import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma, Purchase, PurchaseType } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  parseDateColumnRangeEnd,
  parseDateColumnRangeStart,
} from "../../common/utils/app-timezone.util";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import {
  acquireInventoryMutationLock,
  lockInventoryForMutation,
} from "../../common/utils/inventory-lock.util";
import { orderByCreatedAtDesc } from "../../common/utils/list-order.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { assertSellingPriceNotBelowPurchase } from "../products/product-price.util";
import { ProductsService } from "../products/products.service";
import { PaginatedResult, StoresService } from "../stores/stores.service";
import { ChangePurchaseProductDto } from "./dto/change-purchase-product.dto";
import { CorrectPurchaseDto } from "./dto/correct-purchase.dto";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { CreatePurchaseBatchDto } from "./dto/create-purchase-batch.dto";
import { PurchaseQueryDto } from "./dto/purchase-query.dto";
import { parseAndValidatePurchaseDate } from "./purchase-date.util";
import {
  computeWeightedAverageCost,
  reverseWeightedAverageCost,
} from "./weighted-average.util";

const linkedPurchaseSelect = {
  id: true,
  productId: true,
  product: { select: { id: true, name: true, model: true } },
} satisfies Prisma.PurchaseSelect;

const purchaseInclude = {
  product: { include: { category: true } },
  purchasedBy: { select: { id: true, name: true, email: true } },
  movedFromCorrection: { select: linkedPurchaseSelect },
  movedTo: { select: linkedPurchaseSelect },
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

export type PurchaseProductChangeResult = {
  /** Negative correction on the wrongly recorded product. */
  correction: PurchaseCreateResult;
  /** New purchase on the correct product. */
  purchase: PurchaseCreateResult;
};

type CorrectionDirection = "add" | "subtract" | "change_product";

type RecordPurchaseInput = {
  organizationId: string;
  userId: string;
  warehouseId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPurchasePrice: number;
  purchaseDate: Date;
  invoiceNumber: string | null;
  note: string | null;
  /** Set only when the purchase also changes the product's selling price. */
  newSellingPrice?: number;
  movedFromCorrectionId?: string;
};

type SubtractCorrectionInput = {
  organizationId: string;
  userId: string;
  warehouseId: string;
  original: PurchaseWithDetails;
  quantity: number;
  reason: string;
  direction: Extract<CorrectionDirection, "subtract" | "change_product">;
  auditExtra?: Prisma.InputJsonObject;
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
      const purchase = await this.recordPurchaseInTx(tx, {
        organizationId,
        userId: user.id,
        warehouseId: warehouse.id,
        productId: dto.productId,
        productName: product.name,
        quantity: dto.quantity,
        unitPurchasePrice,
        purchaseDate,
        invoiceNumber: dto.invoiceNumber?.trim() || null,
        note: dto.note?.trim() || null,
        newSellingPrice:
          dto.newSellingPrice !== undefined ? sellingPrice : undefined,
      });
      return purchase.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.loadPurchaseResult(purchaseId, dto.productId);
  }

  async createBatch(
    dto: CreatePurchaseBatchDto,
    user: CurrentUserPayload,
  ): Promise<PurchaseCreateResult[]> {
    // Guard: duplicate productIds in the same batch would produce ambiguous
    // corrections later, so we reject them early.
    const productIds = dto.items.map((i) => i.productId);
    const uniqueIds = new Set(productIds);
    if (uniqueIds.size !== productIds.length) {
      const dupes = productIds.filter((id, idx) => productIds.indexOf(id) !== idx);
      throw new BadRequestException(
        `Duplicate products in batch: ${[...new Set(dupes)].join(", ")}`,
      );
    }

    const purchaseDate = parseAndValidatePurchaseDate(dto.purchaseDate);
    const organizationId = requireOrganizationId(user);
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);

    // Pre-fetch all products before opening the transaction — fails fast if any
    // productId is unknown, without wasting a tx.
    const products = await Promise.all(
      dto.items.map((item) => this.productsService.findOne(item.productId)),
    );

    // Resolve selling prices and run below-cost assertion outside the tx.
    const resolvedItems = dto.items.map((item, i) => {
      const product = products[i];
      const unitPurchasePrice = toMoneyNumber(item.unitPurchasePrice);
      const sellingPrice =
        item.newSellingPrice !== undefined
          ? toMoneyNumber(item.newSellingPrice)
          : Number(product.sellingPrice);

      if (item.newSellingPrice !== undefined && !item.acceptSellingBelowCost) {
        assertSellingPriceNotBelowPurchase(unitPurchasePrice, sellingPrice);
      }

      return { item, product, unitPurchasePrice, sellingPrice };
    });

    // All items go into a single transaction — all succeed or all roll back.
    const purchaseIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Take every warehouse lock up front in a fixed order so this batch can't
      // deadlock with another multi-product mutation locking the same products.
      await this.lockWarehouseProducts(
        tx,
        organizationId,
        warehouse.id,
        productIds,
      );

      for (const {
        item,
        product,
        unitPurchasePrice,
        sellingPrice,
      } of resolvedItems) {
        const purchase = await this.recordPurchaseInTx(tx, {
          organizationId,
          userId: user.id,
          warehouseId: warehouse.id,
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPurchasePrice,
          purchaseDate,
          invoiceNumber: dto.invoiceNumber?.trim() || null,
          note: dto.note?.trim() || null,
          newSellingPrice:
            item.newSellingPrice !== undefined ? sellingPrice : undefined,
        });
        purchaseIds.push(purchase.id);
      }
    }, MUTATION_TRANSACTION_OPTIONS);

    // Fetch all created purchases with their freshly-updated products.
    return Promise.all(
      purchaseIds.map((id, i) =>
        this.loadPurchaseResult(id, dto.items[i].productId),
      ),
    );
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

    return this.loadPurchaseResult(correctionId, productId);
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
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);

    const correctionId = await this.prisma.$transaction(async (tx) => {
      await this.assertRemovableInTx(
        tx,
        organizationId,
        original,
        dto.quantity,
      );

      const correction = await this.subtractCorrectionInTx(tx, {
        organizationId,
        userId: user.id,
        warehouseId: warehouse.id,
        original,
        quantity: dto.quantity,
        reason: dto.reason.trim(),
        direction: "subtract",
      });
      return correction.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    return this.loadPurchaseResult(correctionId, original.productId);
  }

  /**
   * Move units recorded on the wrong product to the correct one: a negative
   * correction on the original product plus a new purchase on the target
   * product, linked together, in one transaction.
   * @see PURCHASE_CORRECTION_DESIGN.md §11
   */
  async changeProduct(
    purchaseId: string,
    dto: ChangePurchaseProductDto,
    user: CurrentUserPayload,
  ): Promise<PurchaseProductChangeResult> {
    const organizationId = requireOrganizationId(user);
    const original = await this.loadCorrectablePurchase(purchaseId);
    if (dto.productId === original.productId) {
      throw new BadRequestException(
        "Choose a different product: this purchase is already recorded on it",
      );
    }

    const targetProduct = await this.productsService.findOne(dto.productId);
    const unitPurchasePrice = toMoneyNumber(dto.unitPurchasePrice);
    const warehouse =
      await this.storesService.ensureOrgWarehouse(organizationId);
    const reason = dto.reason.trim();

    const { correctionId, newPurchaseId } = await this.prisma.$transaction(
      async (tx) => {
        // Lock order: purchase row first, then warehouse inventory in sorted
        // product order — the same order correctSubtract and createBatch use.
        await this.assertRemovableInTx(
          tx,
          organizationId,
          original,
          dto.quantity,
        );
        await this.lockWarehouseProducts(tx, organizationId, warehouse.id, [
          original.productId,
          dto.productId,
        ]);

        const correction = await this.subtractCorrectionInTx(tx, {
          organizationId,
          userId: user.id,
          warehouseId: warehouse.id,
          original,
          quantity: dto.quantity,
          reason,
          direction: "change_product",
          auditExtra: {
            toProductId: targetProduct.id,
            toProductName: targetProduct.name,
            toUnitPurchasePrice: unitPurchasePrice,
          },
        });

        const purchase = await this.recordPurchaseInTx(tx, {
          organizationId,
          userId: user.id,
          warehouseId: warehouse.id,
          productId: targetProduct.id,
          productName: targetProduct.name,
          quantity: dto.quantity,
          unitPurchasePrice,
          // Same date and invoice as the original so period reports reconcile.
          purchaseDate: original.purchaseDate,
          invoiceNumber: original.invoiceNumber,
          note: reason,
          movedFromCorrectionId: correction.id,
        });

        return { correctionId: correction.id, newPurchaseId: purchase.id };
      },
      MUTATION_TRANSACTION_OPTIONS,
    );

    const [correction, purchase] = await Promise.all([
      this.loadPurchaseResult(correctionId, original.productId),
      this.loadPurchaseResult(newPurchaseId, targetProduct.id),
    ]);
    return { correction, purchase };
  }

  /**
   * Record a purchase row: warehouse stock up, weighted-average cost blended,
   * audit logged. Must run inside a transaction.
   */
  private async recordPurchaseInTx(
    tx: Prisma.TransactionClient,
    input: RecordPurchaseInput,
  ): Promise<Purchase> {
    const {
      organizationId,
      userId,
      warehouseId,
      productId,
      quantity,
      unitPurchasePrice,
      newSellingPrice,
      movedFromCorrectionId,
    } = input;
    const totalCost = toMoneyNumber(unitPurchasePrice * quantity);

    const inventory = await lockInventoryForMutation(
      tx,
      organizationId,
      productId,
      warehouseId,
    );

    const onHandAgg = await tx.inventory.aggregate({
      where: { productId, organizationId },
      _sum: { quantity: true },
    });
    const onHand = onHandAgg._sum.quantity ?? 0;
    // Re-read the average inside the lock — a concurrent purchase may have
    // updated it after any pre-transaction product fetch.
    const { averageCost: lockedAverageCost } =
      await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: { averageCost: true },
      });
    const currentAverage = Number(lockedAverageCost);
    const newAverage = computeWeightedAverageCost(
      onHand,
      currentAverage,
      quantity,
      unitPurchasePrice,
    );

    const purchase = await tx.purchase.create({
      data: withOrganizationId(
        {
          productId,
          quantity,
          unitPurchasePrice,
          totalCost,
          purchaseDate: input.purchaseDate,
          invoiceNumber: input.invoiceNumber,
          note: input.note,
          purchasedById: userId,
          ...(movedFromCorrectionId ? { movedFromCorrectionId } : undefined),
        },
        organizationId,
      ),
    });

    const previousQty = inventory?.quantity ?? 0;
    const newQty = previousQty + quantity;

    const updatedInventory = inventory
      ? await tx.inventory.update({
          where: { productId_storeId: { productId, storeId: warehouseId } },
          data: { quantity: newQty },
        })
      : await tx.inventory.create({
          data: withOrganizationId(
            { productId, storeId: warehouseId, quantity: newQty },
            organizationId,
          ),
        });

    await tx.product.update({
      where: { id: productId },
      data: {
        averageCost: newAverage,
        ...(newSellingPrice !== undefined
          ? { sellingPrice: newSellingPrice }
          : undefined),
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        organizationId,
        action: AuditAction.PURCHASE_CREATED,
        entityType: "purchase",
        entityId: purchase.id,
        oldValue: Prisma.JsonNull,
        newValue: {
          id: purchase.id,
          productId,
          productName: input.productName,
          quantity,
          unitPurchasePrice,
          totalCost,
          purchaseDate: input.purchaseDate,
          invoiceNumber: input.invoiceNumber,
          previousAverageCost: currentAverage,
          newAverageCost: newAverage,
          ...(newSellingPrice !== undefined ? { newSellingPrice } : undefined),
          ...(movedFromCorrectionId ? { movedFromCorrectionId } : undefined),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        organizationId,
        action: AuditAction.INVENTORY_UPDATED,
        entityType: "inventory",
        entityId: updatedInventory.id,
        oldValue: { quantity: previousQty, productId, storeId: warehouseId },
        newValue: { quantity: newQty, productId, storeId: warehouseId },
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

    return purchase;
  }

  /**
   * Write a negative correction against `original`: warehouse stock down,
   * weighted-average cost reversed at the original unit price, audit logged.
   * Call {@link assertRemovableInTx} first, in the same transaction.
   */
  private async subtractCorrectionInTx(
    tx: Prisma.TransactionClient,
    input: SubtractCorrectionInput,
  ): Promise<Purchase> {
    const {
      organizationId,
      userId,
      warehouseId,
      original,
      quantity,
      reason,
      direction,
      auditExtra,
    } = input;
    const productId = original.productId;
    const originalUnitCost = Number(original.unitPurchasePrice);
    const reverseValue = toMoneyNumber(originalUnitCost * quantity);

    const warehouseInventory = await lockInventoryForMutation(
      tx,
      organizationId,
      productId,
      warehouseId,
    );
    const warehouseQty = warehouseInventory?.quantity ?? 0;
    if (!warehouseInventory || warehouseQty < quantity) {
      throw new BadRequestException(
        `Cannot remove ${quantity} units: only ${warehouseQty} are in the warehouse. Units already distributed or sold must be returned first.`,
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
      quantity,
      originalUnitCost,
    );

    const correction = await tx.purchase.create({
      data: withOrganizationId(
        {
          productId,
          quantity: -quantity,
          unitPurchasePrice: originalUnitCost,
          totalCost: -reverseValue,
          type: PurchaseType.correction,
          correctsPurchaseId: original.id,
          invoiceNumber: original.invoiceNumber,
          // Date the reversal to the original purchase so period reports reconcile.
          purchaseDate: original.purchaseDate,
          note: reason,
          purchasedById: userId,
        },
        organizationId,
      ),
    });

    const newWarehouseQty = warehouseQty - quantity;
    const updatedInventory = await tx.inventory.update({
      where: { productId_storeId: { productId, storeId: warehouseId } },
      data: { quantity: newWarehouseQty },
    });

    await tx.product.update({
      where: { id: productId },
      data: { averageCost: newAverage },
    });

    await this.writeCorrectionAuditLogs(tx, {
      userId,
      organizationId,
      correction,
      original,
      purchaseId: original.id,
      productId,
      quantity,
      direction,
      unitPurchasePrice: originalUnitCost,
      totalCost: -reverseValue,
      reason,
      currentAverage,
      newAverage,
      warehouseQty,
      newWarehouseQty,
      warehouseId,
      updatedInventoryId: updatedInventory.id,
      auditExtra,
    });

    return correction;
  }

  /**
   * Lock the original purchase row and check that `quantity` units are still
   * left on it after prior corrections. The lock serialises concurrent
   * removals so two submits can't both pass the check and over-correct.
   *
   * `FOR NO KEY UPDATE` (not `FOR UPDATE`) so that "add missing units", which
   * inserts a correction referencing this row (taking `FOR KEY SHARE`) after
   * locking inventory, never waits on this lock — avoiding a lock-order cycle.
   */
  private async assertRemovableInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    original: PurchaseWithDetails,
    quantity: number,
  ): Promise<void> {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM purchase
      WHERE id = ${original.id}
        AND "organizationId" = ${organizationId}
      FOR NO KEY UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundException(
        `Purchase with id "${original.id}" not found`,
      );
    }

    const netCorrection = await this.getNetCorrectionQuantity(tx, original.id);
    const removable = Math.max(0, original.quantity + netCorrection);
    if (quantity > removable) {
      throw new BadRequestException(
        `Cannot remove ${quantity} units: only ${removable} remain on this purchase after prior corrections`,
      );
    }
  }

  /** Acquire warehouse inventory locks for several products in a stable order. */
  private async lockWarehouseProducts(
    tx: Prisma.TransactionClient,
    organizationId: string,
    warehouseId: string,
    productIds: string[],
  ): Promise<void> {
    for (const productId of [...new Set(productIds)].sort()) {
      await acquireInventoryMutationLock(
        tx,
        organizationId,
        productId,
        warehouseId,
      );
    }
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

  private async getNetCorrectionQuantity(
    tx: Prisma.TransactionClient,
    purchaseId: string,
  ): Promise<number> {
    const priorAgg = await tx.purchase.aggregate({
      where: {
        correctsPurchaseId: purchaseId,
        type: PurchaseType.correction,
      },
      _sum: { quantity: true },
    });
    return priorAgg._sum.quantity ?? 0;
  }

  private async loadPurchaseResult(
    purchaseId: string,
    productId: string,
  ): Promise<PurchaseCreateResult> {
    const purchase = await this.prisma.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: purchaseInclude,
    });
    const updatedProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { category: true },
    });

    return { ...purchase, product: updatedProduct };
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
      direction: CorrectionDirection;
      unitPurchasePrice: number;
      totalCost: number;
      reason: string;
      currentAverage: number;
      newAverage: number;
      warehouseQty: number;
      newWarehouseQty: number;
      warehouseId: string;
      updatedInventoryId: string;
      auditExtra?: Prisma.InputJsonObject;
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
      auditExtra,
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
          ...auditExtra,
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
