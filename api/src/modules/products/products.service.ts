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

  async create(
    dto: CreateProductDto,
    user: CurrentUserPayload,
  ): Promise<ProductWithCategory> {
    await this.assertCategoryExists(dto.categoryId);

    const name = dto.name.trim();
    const normalizedName = normalizeProductName(name);
    await this.assertUniqueActiveName(normalizedName);

    const product = await this.prisma.product.create({
      data: {
        name,
        normalizedName,
        categoryId: dto.categoryId,
        description: dto.description,
        purchasePrice: dto.purchasePrice,
        sellingPrice: dto.sellingPrice,
        createdById: user.id,
      },
      include: { category: true },
    });

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

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const normalizedName = normalizeProductName(name);

      if (normalizedName !== existing.normalizedName) {
        await this.assertUniqueActiveName(normalizedName, id);
      }

      data.name = name;
      data.normalizedName = normalizedName;
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });

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

    await this.assertUniqueActiveName(normalizeProductName(existing.name), id);

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

  private async assertUniqueActiveName(
    normalizedName: string,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.product.findFirst({
      where: {
        normalizedName,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : undefined),
      },
      select: { name: true },
    });

    if (conflict) {
      throw new ConflictException(
        `A product named "${conflict.name}" already exists`,
      );
    }
  }
}
