import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  parseDateColumnRangeEnd,
  parseDateColumnRangeStart,
} from "../../common/utils/app-timezone.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { PaginatedResult } from "../stores/stores.service";
import { CorrectSaleDto } from "./dto/correct-sale.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { SaleQueryDto } from "./dto/sale-query.dto";
import { parseAndValidateSaleDate } from "./sale-date.util";

const saleInclude = {
  product: { include: { category: true } },
  store: true,
  soldBy: { select: { id: true, name: true, email: true } },
  corrections: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.SaleInclude;

export type SaleWithDetails = Prisma.SaleGetPayload<{
  include: typeof saleInclude;
}>;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async findAll(
    query: SaleQueryDto,
    user: CurrentUserPayload,
  ): Promise<PaginatedResult<SaleWithDetails>> {
    const skip = (query.page - 1) * query.limit;
    const storeId = this.resolveStoreFilter(user, query.storeId);
    const searchTerm =
      typeof query.search === "string" ? query.search.trim() : "";
    const fromDate =
      typeof query.fromDate === "string" ? query.fromDate.trim() : "";
    const toDate = typeof query.toDate === "string" ? query.toDate.trim() : "";

    const where: Prisma.SaleWhereInput = {
      ...(storeId ? { storeId } : undefined),
      ...(query.productId ? { productId: query.productId } : undefined),
      ...(query.status ? { status: query.status } : undefined),
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
            saleDate: {
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
      this.prisma.sale.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: saleInclude,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(
    dto: CreateSaleDto,
    user: CurrentUserPayload,
  ): Promise<SaleWithDetails> {
    const storeId = this.requireManagerStore(user);
    const product = await this.productsService.findOne(dto.productId);
    const saleDate = parseAndValidateSaleDate(dto.saleDate);

    const unitPrice = Number(product.sellingPrice);
    const unitPurchasePrice = Number(product.purchasePrice);
    const totalAmount = unitPrice * dto.quantitySold;

    const saleId = await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_storeId: { productId: dto.productId, storeId },
        },
      });

      if (!inventory) {
        throw new BadRequestException(
          `Product "${product.name}" is not stocked at your store`,
        );
      }

      if (inventory.quantity < dto.quantitySold) {
        throw new BadRequestException(
          `Insufficient stock: ${inventory.quantity} available, ${dto.quantitySold} requested`,
        );
      }

      const sale = await tx.sale.create({
        data: {
          productId: dto.productId,
          storeId,
          soldById: user.id,
          quantitySold: dto.quantitySold,
          unitPrice,
          unitPurchasePrice,
          totalAmount,
          saleDate,
          note: dto.note,
          status: "active",
        },
      });

      const previousQty = inventory.quantity;
      const newQty = previousQty - dto.quantitySold;

      const updatedInventory = await tx.inventory.update({
        where: { productId_storeId: { productId: dto.productId, storeId } },
        data: { quantity: newQty },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "SALE_CREATED",
          entityType: "sale",
          entityId: sale.id,
          oldValue: Prisma.JsonNull,
          newValue: {
            id: sale.id,
            productId: dto.productId,
            productName: product.name,
            productCategory: product.category.name,
            storeId,
            // storeName: store.name,
            quantitySold: dto.quantitySold,
            unitPrice,
            unitPurchasePrice,
            totalAmount,
            saleDate,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "INVENTORY_UPDATED",
          entityType: "inventory",
          entityId: updatedInventory.id,
          oldValue: {
            quantity: previousQty,
            productId: dto.productId,
            storeId,
          },
          newValue: { quantity: newQty, productId: dto.productId, storeId },
        },
      });

      return sale.id;
    });

    return this.prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: saleInclude,
    });
  }

  async correct(
    id: string,
    dto: CorrectSaleDto,
    user: CurrentUserPayload,
  ): Promise<SaleWithDetails> {
    const storeId = this.requireManagerStore(user);

    const existing = await this.prisma.sale.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      throw new NotFoundException(`Sale with id "${id}" not found`);
    }

    if (existing.status !== "active") {
      throw new BadRequestException("Only active sales can be corrected");
    }

    const originalQuantity = existing.quantitySold;

    if (dto.correctedQuantity === originalQuantity) {
      throw new BadRequestException(
        "Corrected quantity must differ from the original quantity",
      );
    }

    const delta = dto.correctedQuantity - originalQuantity;
    const unitPrice = Number(existing.unitPrice);
    const totalAmount = unitPrice * dto.correctedQuantity;

    const saleId = await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: {
          productId_storeId: {
            productId: existing.productId,
            storeId: existing.storeId,
          },
        },
      });

      if (!inventory) {
        throw new BadRequestException(
          "Inventory record not found for this sale",
        );
      }

      if (delta > 0 && inventory.quantity < delta) {
        throw new BadRequestException(
          `Insufficient stock to increase sale: ${inventory.quantity} available, ${delta} additional units required`,
        );
      }

      const previousQty = inventory.quantity;
      const newQty = previousQty - delta;

      if (newQty < 0) {
        throw new BadRequestException(
          "Correction would result in negative stock",
        );
      }

      const sale = await tx.sale.update({
        where: { id },
        data: {
          quantitySold: dto.correctedQuantity,
          totalAmount,
          status: "corrected",
        },
      });

      await tx.saleCorrection.create({
        data: {
          saleId: id,
          originalQuantity,
          correctedQuantity: dto.correctedQuantity,
          reason: dto.reason,
          correctedById: user.id,
        },
      });

      const updatedInventory = await tx.inventory.update({
        where: {
          productId_storeId: {
            productId: existing.productId,
            storeId: existing.storeId,
          },
        },
        data: { quantity: newQty },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "SALE_CORRECTED",
          entityType: "sale",
          entityId: sale.id,
          oldValue: {
            quantitySold: originalQuantity,
            totalAmount: Number(existing.totalAmount),
          },
          newValue: {
            quantitySold: dto.correctedQuantity,
            totalAmount,
            reason: dto.reason,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "INVENTORY_UPDATED",
          entityType: "inventory",
          entityId: updatedInventory.id,
          oldValue: {
            quantity: previousQty,
            productId: existing.productId,
            storeId: existing.storeId,
          },
          newValue: {
            quantity: newQty,
            productId: existing.productId,
            storeId: existing.storeId,
          },
        },
      });

      return sale.id;
    });

    return this.prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: saleInclude,
    });
  }

  private resolveStoreFilter(
    user: CurrentUserPayload,
    queryStoreId?: string,
  ): string | undefined {
    if (user.role === UserRole.branch_manager) {
      if (!user.storeId) {
        throw new ForbiddenException("No store assigned to your account");
      }
      return user.storeId;
    }

    return queryStoreId;
  }

  private requireManagerStore(user: CurrentUserPayload): string {
    if (user.role !== UserRole.branch_manager) {
      throw new ForbiddenException(
        "Only branch managers can perform this action",
      );
    }

    if (!user.storeId) {
      throw new ForbiddenException("No store assigned to your account");
    }

    return user.storeId;
  }
}
