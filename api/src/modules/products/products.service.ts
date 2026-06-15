import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { PaginatedResult } from "../stores/stores.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { DeactivateProductDto } from "./dto/deactivate-product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { normalizeProductName } from "./product-name.util";
import { assertSellingPriceNotBelowPurchase } from "./product-price.util";

export type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductWithCategory>> {
    const { page, limit, search, categoryId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(categoryId ? { categoryId } : undefined),
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
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

  async findOne(id: string): Promise<ProductWithCategory> {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return product;
  }

  /** Active or inactive — for admin inventory reads and stock corrections on discontinued products. */
  async findOneIncludingInactive(id: string): Promise<ProductWithCategory> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return product;
  }

  async create(
    dto: CreateProductDto,
    user: CurrentUserPayload,
  ): Promise<ProductWithCategory> {
    await this.assertCategoryExists(dto.categoryId);

    const name = dto.name.trim();
    const normalizedName = normalizeProductName(name);
    const model = dto.model?.trim() || null;
    const normalizedModel = model ? normalizeProductName(model) : null;
    await this.assertUniqueNameAndModel(normalizedName, normalizedModel);

    assertSellingPriceNotBelowPurchase(dto.purchasePrice, dto.sellingPrice);

    const product = await this.prisma.product
      .create({
        data: {
          name,
          normalizedName,
          model,
          normalizedModel,
          categoryId: dto.categoryId,
          description: dto.description,
          purchasePrice: dto.purchasePrice,
          sellingPrice: dto.sellingPrice,
          createdById: user.id,
        },
        include: { category: true },
      })
      .catch((e) => this.handleP2002(e));

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.PRODUCT_CREATED,
        entityType: "product",
        entityId: product.id,
        oldValue: Prisma.JsonNull,
        newValue: product,
      },
    });

    return product;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    user: CurrentUserPayload,
  ): Promise<ProductWithCategory> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);

    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const data: Prisma.ProductUpdateInput = { ...dto };

    const existingModel = (existing as any).model as string | null;
    const existingNormalizedModel = (existing as any).normalizedModel as string | null;
    const incomingModel =
      dto.model !== undefined ? dto.model.trim() || null : existingModel;
    const incomingNormalizedModel = incomingModel
      ? normalizeProductName(incomingModel)
      : null;

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const normalizedName = normalizeProductName(name);

      if (
        normalizedName !== existing.normalizedName ||
        incomingNormalizedModel !== existingNormalizedModel
      ) {
        await this.assertUniqueNameAndModel(
          normalizedName,
          incomingNormalizedModel,
          id,
        );
      }

      data.name = name;
      data.normalizedName = normalizedName;
    } else if (dto.model !== undefined) {
      await this.assertUniqueNameAndModel(
        existing.normalizedName,
        incomingNormalizedModel,
        id,
      );
    }

    if (dto.model !== undefined) {
      (data as any).model = incomingModel;
      (data as any).normalizedModel = incomingNormalizedModel;
    }

    const purchasePrice =
      dto.purchasePrice !== undefined
        ? dto.purchasePrice
        : Number(existing.purchasePrice);
    const sellingPrice =
      dto.sellingPrice !== undefined
        ? dto.sellingPrice
        : Number(existing.sellingPrice);

    if (dto.purchasePrice !== undefined || dto.sellingPrice !== undefined) {
      assertSellingPriceNotBelowPurchase(purchasePrice, sellingPrice);
    }

    const product = await this.prisma.product
      .update({
        where: { id },
        data,
        include: { category: true },
      })
      .catch((e) => this.handleP2002(e));

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.PRODUCT_UPDATED,
        entityType: "product",
        entityId: product.id,
        oldValue: existing,
        newValue: product,
      },
    });

    return product;
  }

  async deactivate(
    id: string,
    dto: DeactivateProductDto,
    user: CurrentUserPayload,
  ): Promise<void> {
    const existing = await this.findOne(id);
    const stockRows = await this.prisma.inventory.findMany({
      where: { productId: id, quantity: { gt: 0 } },
      include: { store: { select: { name: true } } },
    });

    if (stockRows.length > 0 && !dto.force) {
      const totalUnits = stockRows.reduce((sum, row) => sum + row.quantity, 0);
      throw new BadRequestException(
        `Cannot deactivate product: ${totalUnits} unit(s) remain across ${stockRows.length} store(s). Zero stock first or send { "force": true }.`,
      );
    }

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PRODUCT_DEACTIVATED",
        entityType: "product",
        entityId: id,
        oldValue: existing,
        newValue: {
          ...existing,
          isActive: false,
          ...(dto.force && stockRows.length > 0
            ? {
                forcedDespiteStock: true,
                remainingStock: stockRows.map((row) => ({
                  storeId: row.storeId,
                  storeName: row.store.name,
                  quantity: row.quantity,
                })),
              }
            : undefined),
        },
      },
    });
  }

  async reactivate(
    id: string,
    user: CurrentUserPayload,
  ): Promise<ProductWithCategory> {
    const existing = await this.prisma.product.findFirst({
      where: { id, isActive: false },
      include: { category: true },
    });

    if (!existing) {
      throw new NotFoundException(`Inactive product with id "${id}" not found`);
    }

    await this.assertUniqueNameAndModel(
      normalizeProductName(existing.name),
      (existing as any).normalizedModel as string | null,
      id,
    );

    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: true },
      include: { category: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PRODUCT_REACTIVATED",
        entityType: "product",
        entityId: id,
        oldValue: existing,
        newValue: product,
      },
    });

    return product;
  }

  private async assertCategoryExists(categoryId: number): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${categoryId}" not found`);
    }
  }

  private async assertUniqueNameAndModel(
    normalizedName: string,
    normalizedModel: string | null,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.product.findFirst({
      where: {
        normalizedName,
        normalizedModel,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : undefined),
      },
      select: { name: true, model: true },
    });

    if (conflict) {
      const label = conflict.model
        ? `${conflict.name} (${conflict.model})`
        : conflict.name;
      throw new ConflictException(`A product named "${label}" already exists`);
    }
  }

  private handleP2002(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("A product with this name and model already exists");
    }
    throw error;
  }
}
