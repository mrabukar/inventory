import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

export type CategoryWithCount = {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { products: number };
};

const categoryWithProductCount = {
  include: {
    _count: {
      select: {
        products: { where: { isActive: true } },
      },
    },
  },
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<CategoryWithCount[]> {
    return this.prisma.category.findMany({
      orderBy: { name: "asc" },
      ...categoryWithProductCount,
    });
  }

  async findOne(id: number): Promise<CategoryWithCount> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      ...categoryWithProductCount,
    });
    if (!category) {
      throw new NotFoundException(`Category with id "${id}" not found`);
    }
    return category;
  }

  async create(
    dto: CreateCategoryDto,
    user: CurrentUserPayload,
  ): Promise<CategoryWithCount> {
    await this.assertUniqueName(dto.name);
    return this.prisma.category.create({
      data: withOrganizationId(
        {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
        },
        requireOrganizationId(user),
      ),
      ...categoryWithProductCount,
    });
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryWithCount> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }
    await this.findOne(id);
    if (dto.name !== undefined) {
      await this.assertUniqueName(dto.name, id);
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : undefined),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : undefined),
      },
      ...categoryWithProductCount,
    });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${productCount} product(s) are assigned to this category.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async assertUniqueName(
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" } },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A category named "${name.trim()}" already exists`,
      );
    }
  }
}
