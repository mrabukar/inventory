import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ExpenseCategory } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
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

  async create(dto: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
    await this.assertUniqueName(dto.name);

    return this.prisma.expenseCategory.create({ data: dto });
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
      await this.assertUniqueName(dto.name);
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

  private async assertUniqueName(name: string): Promise<void> {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException(
        `An expense category named "${name}" already exists`,
      );
    }
  }
}
