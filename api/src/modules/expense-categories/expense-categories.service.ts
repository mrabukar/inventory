import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ExpenseCategory } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { withOrganizationId } from "../../common/utils/with-organization-id.util";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: number): Promise<ExpenseCategory> {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Expense category with id "${id}" not found`);
    }

    return category;
  }

  async create(
    dto: CreateExpenseCategoryDto,
    user: CurrentUserPayload,
  ): Promise<ExpenseCategory> {
    const organizationId = requireOrganizationId(user);
    await this.assertUniqueName(dto.name, organizationId);

    return this.prisma.expenseCategory.create({
      data: withOrganizationId(dto, organizationId),
    });
  }

  async update(
    id: number,
    dto: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);

    if (dto.name && dto.name !== existing.name) {
      await this.assertUniqueName(dto.name, existing.organizationId, id);
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);

    const expenseCount = await this.prisma.expense.count({
      where: { categoryId: id },
    });

    if (expenseCount > 0) {
      throw new ConflictException(
        `Cannot delete category: ${expenseCount} expense(s) still use it`,
      );
    }

    await this.prisma.expenseCategory.delete({ where: { id } });
  }

  private async assertUniqueName(
    name: string,
    organizationId: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { name, organizationId },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `An expense category named "${name}" already exists`,
      );
    }
  }
}
