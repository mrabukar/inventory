import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Expense, Prisma } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  parseDateColumnRangeEnd,
  parseDateColumnRangeStart,
} from "../../common/utils/app-timezone.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ExpenseCategoriesService } from "../expense-categories/expense-categories.service";
import { PaginatedResult } from "../stores/stores.service";
import { StoresService } from "../stores/stores.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ExpenseQueryDto } from "./dto/expense-query.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { parseAndValidateExpenseDate } from "./expense-date.util";

const expenseInclude = {
  category: true,
  store: true,
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ExpenseInclude;

export type ExpenseWithDetails = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenseCategoriesService: ExpenseCategoriesService,
    private readonly storesService: StoresService,
  ) {}

  async findAll(
    query: ExpenseQueryDto,
  ): Promise<PaginatedResult<ExpenseWithDetails>> {
    const skip = (query.page - 1) * query.limit;
    const searchTerm =
      typeof query.search === "string" ? query.search.trim() : "";
    const fromDate =
      typeof query.fromDate === "string" ? query.fromDate.trim() : "";
    const toDate = typeof query.toDate === "string" ? query.toDate.trim() : "";

    const expenseDateRange = this.buildExpenseDateRange(fromDate, toDate);

    const where: Prisma.ExpenseWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : undefined),
      ...(query.companyWideOnly ? { storeId: null } : undefined),
      ...(!query.companyWideOnly && query.storeId
        ? { storeId: query.storeId }
        : undefined),
      ...(searchTerm
        ? { title: { contains: searchTerm, mode: "insensitive" } }
        : undefined),
      ...(expenseDateRange ? { expenseDate: expenseDateRange } : undefined),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { expenseDate: "desc" },
        include: expenseInclude,
      }),
      this.prisma.expense.count({ where }),
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

  async findOne(id: string): Promise<ExpenseWithDetails> {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: expenseInclude,
    });

    if (!expense) {
      throw new NotFoundException(`Expense with id "${id}" not found`);
    }

    return expense;
  }

  async create(
    dto: CreateExpenseDto,
    user: CurrentUserPayload,
  ): Promise<ExpenseWithDetails> {
    const category = await this.expenseCategoriesService.findOne(
      dto.categoryId,
    );
    const expenseDate = parseAndValidateExpenseDate(dto.expenseDate);

    if (dto.storeId) {
      await this.storesService.findOne(dto.storeId);
    }

    const expenseId = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          title: dto.title,
          amount: dto.amount,
          categoryId: dto.categoryId,
          storeId: dto.storeId ?? null,
          expenseDate,
          note: dto.note,
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "EXPENSE_CREATED",
          entityType: "expense",
          entityId: expense.id,
          oldValue: Prisma.JsonNull,
          newValue: this.toAuditSnapshot(expense, category.name),
        },
      });

      return expense.id;
    });

    return this.findOne(expenseId);
  }

  async update(
    id: string,
    dto: UpdateExpenseDto,
    user: CurrentUserPayload,
  ): Promise<ExpenseWithDetails> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const existing = await this.findOne(id);
    let categoryName = existing.category.name;

    if (dto.categoryId !== undefined) {
      const category = await this.expenseCategoriesService.findOne(
        dto.categoryId,
      );
      categoryName = category.name;
    }

    if (dto.storeId) {
      await this.storesService.findOne(dto.storeId);
    }

    const expenseDate =
      dto.expenseDate !== undefined
        ? parseAndValidateExpenseDate(dto.expenseDate)
        : undefined;

    const expenseId = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : undefined),
          ...(dto.amount !== undefined ? { amount: dto.amount } : undefined),
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId }
            : undefined),
          ...(dto.storeId !== undefined ? { storeId: dto.storeId } : undefined),
          ...(expenseDate !== undefined ? { expenseDate } : undefined),
          ...(dto.note !== undefined ? { note: dto.note } : undefined),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "EXPENSE_UPDATED",
          entityType: "expense",
          entityId: expense.id,
          oldValue: this.toAuditSnapshot(existing, existing.category.name),
          newValue: this.toAuditSnapshot(expense, categoryName),
        },
      });

      return expense.id;
    });

    return this.findOne(expenseId);
  }

  async remove(id: string, user: CurrentUserPayload): Promise<void> {
    const existing = await this.findOne(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "EXPENSE_DELETED",
          entityType: "expense",
          entityId: id,
          oldValue: this.toAuditSnapshot(existing, existing.category.name),
          newValue: Prisma.JsonNull,
        },
      });
    });
  }

  private buildExpenseDateRange(
    fromDate: string,
    toDate: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!fromDate && !toDate) {
      return undefined;
    }

    const range: Prisma.DateTimeFilter = {};

    if (fromDate) {
      range.gte = parseDateColumnRangeStart(fromDate);
    }

    if (toDate) {
      range.lte = parseDateColumnRangeEnd(toDate);
    }

    return range;
  }

  private toAuditSnapshot(
    expense: Expense,
    categoryName: string,
  ): Prisma.InputJsonObject {
    return {
      id: expense.id,
      title: expense.title,
      amount: Number(expense.amount),
      categoryId: expense.categoryId,
      categoryName,
      storeId: expense.storeId,
      expenseDate: expense.expenseDate.toISOString(),
      note: expense.note,
    };
  }
}
