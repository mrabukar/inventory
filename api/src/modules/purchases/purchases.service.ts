import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  parseDateColumnRangeEnd,
  parseDateColumnRangeStart,
} from "../../common/utils/app-timezone.util";
import { MUTATION_TRANSACTION_OPTIONS } from "../../common/constants/prisma-transaction.constants";
import { lockInventoryForMutation } from "../../common/utils/inventory-lock.util";
import { toMoneyNumber } from "../../common/utils/money.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { PrismaService } from "../../prisma/prisma.service";
import { assertSellingPriceNotBelowPurchase } from "../products/product-price.util";
import { ProductsService } from "../products/products.service";
import { PaginatedResult, StoresService } from "../stores/stores.service";
import { CreatePurchaseDto } from "./dto/create-purchase.dto";
import { PurchaseQueryDto } from "./dto/purchase-query.dto";
import { SetOpeningCostDto } from "./dto/set-opening-cost.dto";
import { parseAndValidatePurchaseDate } from "./purchase-date.util";
import { computeWeightedAverageCost } from "./weighted-average.util";

const purchaseInclude = {
  product: { include: { category: true } },
  purchasedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PurchaseInclude;

export type PurchaseWithDetails = Prisma.PurchaseGetPayload<{
  include: typeof purchaseInclude;
}>;

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
  ): Promise<PaginatedResult<PurchaseWithDetails>> {
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

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchaseDate: "desc" },
        include: purchaseInclude,
      }),
      this.prisma.purchase.count({ where }),
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

  async findByProduct(
    productId: string,
    query: PurchaseQueryDto,
  ): Promise<PaginatedResult<PurchaseWithDetails>> {
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
      const currentAverage = Number(product.averageCost);
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

  async recordOpeningCost(
    productId: string,
    dto: SetOpeningCostDto,
    user: CurrentUserPayload,
  ): Promise<PurchaseCreateResult> {
    const product = await this.productsService.findOneIncludingInactive(
      productId,
    );
    const purchaseDate = parseAndValidatePurchaseDate(dto.purchaseDate);
    const unitPurchasePrice = toMoneyNumber(dto.unitPurchasePrice);
    const organizationId = requireOrganizationId(user);

    const currentAverage = Number(product.averageCost);
    if (currentAverage > 0) {
      throw new BadRequestException(
        "This product already has an average cost. Use Record Purchase for new stock.",
      );
    }

    const onHandAgg = await this.prisma.inventory.aggregate({
      where: { productId, organizationId },
      _sum: { quantity: true },
    });
    const onHand = onHandAgg._sum.quantity ?? 0;
    if (onHand <= 0) {
      throw new BadRequestException(
        "Cannot set opening cost: no stock on hand for this product.",
      );
    }

    const totalCost = toMoneyNumber(unitPurchasePrice * onHand);
    const sellingPrice =
      dto.newSellingPrice !== undefined
        ? toMoneyNumber(dto.newSellingPrice)
        : Number(product.sellingPrice);

    if (dto.newSellingPrice !== undefined && !dto.acceptSellingBelowCost) {
      assertSellingPriceNotBelowPurchase(unitPurchasePrice, sellingPrice);
    }

    const note =
      dto.note?.trim() ||
      "Opening balance — cost for stock on hand before purchasing was tracked";

    const purchaseId = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: withOrganizationId(
          {
            productId,
            quantity: onHand,
            unitPurchasePrice,
            totalCost,
            purchaseDate,
            invoiceNumber: null,
            note,
            purchasedById: user.id,
          },
          organizationId,
        ),
      });

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          averageCost: unitPurchasePrice,
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
            productId,
            productName: product.name,
            quantity: onHand,
            unitPurchasePrice,
            totalCost,
            purchaseDate,
            openingBalance: true,
            note,
            previousAverageCost: currentAverage,
            newAverageCost: unitPurchasePrice,
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
          action: AuditAction.PRODUCT_COST_RECALCULATED,
          entityType: "product",
          entityId: productId,
          oldValue: { averageCost: currentAverage },
          newValue: {
            averageCost: unitPurchasePrice,
            openingBalance: true,
            onHand,
          },
        },
      });

      return purchase.id;
    }, MUTATION_TRANSACTION_OPTIONS);

    const purchase = await this.prisma.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: purchaseInclude,
    });

    const updatedProduct = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { category: true },
    });

    return {
      ...purchase,
      product: updatedProduct,
    };
  }
}
