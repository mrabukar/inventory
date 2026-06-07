import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import {
  calendarDateDaysAgo,
  calendarDateToDbDate,
  eachCalendarDate,
  getAppTimezone,
  resolvePreviousMonthRange,
  shiftCalendarDateBackMonths,
  startOfMonthCalendarDate,
  todayCalendarDate,
} from "../../common/utils/app-timezone.util";
import {
  grossMarginPercent,
  netProfitMoney,
  parseRawMoney,
  subtractMoney,
  toMoneyNumber,
} from "../../common/utils/money.util";
import {
  buildAdminPeriodComparison,
  buildManagerPeriodComparison,
} from "../../common/utils/period-comparison.util";
import { PrismaService } from "../../prisma/prisma.service";
import { ReportQueryDto } from "./dto/report-query.dto";
import {
  buildMonthSeries,
  monthLabel,
  resolveReportDateRange,
  type ReportDateRange,
} from "./report-date.util";

type MonthlyTotalsRow = { month: string; revenue: unknown; cogs: unknown };
type MonthlyExpenseRow = { month: string; amount: unknown };
type ExpenseCategoryRow = {
  categoryId: number;
  categoryName: string;
  amount: number;
};
type TopProductRow = {
  productId: string;
  productName: string;
  unitsSold: number;
};
type TopStoreRow = { storeId: string; storeName: string; revenue: number };
type LowStockRow = {
  inventoryId: string;
  productId: string;
  productName: string;
  storeId: string;
  storeName: string;
  quantity: number;
  lowStockThreshold: number;
};
type DailyRevenueRow = { date: string; revenue: number };
type CategoryStockRow = {
  categoryId: number;
  categoryName: string;
  units: number;
};
type ProductDistributionRow = {
  categoryId: number;
  categoryName: string;
  unitsSold: number;
  percent: number;
};

const recentSaleInclude = {
  product: { include: { category: true } },
  store: true,
  soldBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminDashboard(query: ReportQueryDto) {
    const range = resolveReportDateRange(query.fromDate, query.toDate);
    const storeId =
      typeof query.storeId === "string" ? query.storeId.trim() : undefined;
    const categoryId = query.categoryId;

    const saleWhere = this.buildSaleWhere(range, storeId, categoryId);
    const expenseWhere = this.buildExpenseWhere(range, storeId);
    const previousRange = resolvePreviousMonthRange(range);
    const previousSaleWhere = this.buildSaleWhere(
      previousRange,
      storeId,
      categoryId,
    );
    const previousExpenseWhere = this.buildExpenseWhere(previousRange, storeId);

    const [
      summary,
      previousMetrics,
      monthlySales,
      monthlyExpenses,
      expenseBreakdown,
      topProducts,
      topStores,
      productDistribution,
      stockByCategory,
      recentSales,
      lowStock,
    ] = await Promise.all([
      this.computePeriodSummary(saleWhere, expenseWhere, storeId),
      this.computePeriodMetrics(previousSaleWhere, previousExpenseWhere),
      this.fetchMonthlySales(saleWhere, range),
      this.fetchMonthlyExpenses(expenseWhere, range),
      this.fetchExpenseBreakdown(expenseWhere),
      this.fetchTopProducts(saleWhere),
      storeId ? Promise.resolve([]) : this.fetchTopStores(saleWhere),
      this.fetchProductDistribution(saleWhere),
      this.fetchStockByCategory(storeId),
      this.fetchRecentSales(saleWhere),
      this.fetchLowStock(storeId),
    ]);

    const monthKeys = buildMonthSeries(range.fromCalendar, range.toCalendar);
    const revenueCogsExpenses = monthKeys.map((key) => {
      const sales = monthlySales.find((row) => row.month === key);
      const expenses = monthlyExpenses.find((row) => row.month === key);
      const revenue = sales?.revenue ?? 0;
      const cogs = sales?.cogs ?? 0;
      const exp = expenses?.amount ?? 0;

      return {
        month: monthLabel(key),
        monthKey: key,
        revenue,
        cogs,
        expenses: exp,
        netProfit: netProfitMoney(revenue, cogs, exp),
      };
    });

    return {
      period: {
        from: range.fromCalendar,
        to: range.toCalendar,
        timezone: getAppTimezone(),
      },
      summary,
      comparison: buildAdminPeriodComparison(summary, previousMetrics, {
        from: previousRange.fromCalendar,
        to: previousRange.toCalendar,
      }),
      charts: {
        revenueCogsExpenses,
        netProfitTrend: revenueCogsExpenses.map((row) => ({
          month: row.month,
          monthKey: row.monthKey,
          netProfit: row.netProfit,
        })),
        expenseBreakdown,
        productDistribution,
        stockByCategory,
        topProducts,
        topStores,
      },
      recentSales,
      lowStock,
    };
  }

  async getManagerDashboard(user: CurrentUserPayload) {
    const storeId = this.requireManagerStore(user);
    const today = todayCalendarDate();
    const monthStart = startOfMonthCalendarDate(today);
    const trendStart = calendarDateDaysAgo(29, today);
    const previousToday = shiftCalendarDateBackMonths(today, 1);
    const previousMonthStart = shiftCalendarDateBackMonths(monthStart, 1);
    const previousMonthEnd = shiftCalendarDateBackMonths(today, 1);

    const [
      todaySales,
      monthSales,
      previousTodaySales,
      previousMonthSales,
      inStockBalance,
      lowStockCount,
      salesTrend,
      stockByCategory,
      recentSales,
      lowStock,
    ] = await Promise.all([
      this.aggregateSales({
        storeId,
        fromCalendar: today,
        toCalendar: today,
      }),
      this.aggregateSales({
        storeId,
        fromCalendar: monthStart,
        toCalendar: today,
      }),
      this.aggregateSales({
        storeId,
        fromCalendar: previousToday,
        toCalendar: previousToday,
      }),
      this.aggregateSales({
        storeId,
        fromCalendar: previousMonthStart,
        toCalendar: previousMonthEnd,
      }),
      this.sumInventoryUnits(storeId),
      this.countLowStock(storeId),
      this.fetchDailyRevenue(storeId, trendStart, today),
      this.fetchStockByCategory(storeId),
      this.fetchRecentSales({ storeId }),
      this.fetchLowStock(storeId),
    ]);

    return {
      storeId,
      summary: {
        todayRevenue: todaySales.revenue,
        todayUnitsSold: todaySales.unitsSold,
        monthRevenue: monthSales.revenue,
        inStockBalance,
        lowStockCount,
      },
      comparison: buildManagerPeriodComparison(
        {
          todayRevenue: todaySales.revenue,
          monthRevenue: monthSales.revenue,
        },
        {
          todayRevenue: previousTodaySales.revenue,
          monthRevenue: previousMonthSales.revenue,
        },
      ),
      charts: {
        salesTrend,
        stockByCategory,
      },
      recentSales,
      lowStock,
    };
  }

  async getFinancialSummary(query: ReportQueryDto) {
    const range = resolveReportDateRange(query.fromDate, query.toDate);
    const storeId =
      typeof query.storeId === "string" ? query.storeId.trim() : undefined;

    const saleWhere = this.buildSaleWhere(range, storeId);
    const expenseWhere = this.buildExpenseWhere(range, storeId);

    const [
      summary,
      monthlySales,
      monthlyExpenses,
      expenseByCategory,
      stockInvestment,
    ] = await Promise.all([
      this.computePeriodSummary(saleWhere, expenseWhere, storeId),
      this.fetchMonthlySales(saleWhere, range),
      this.fetchMonthlyExpenses(expenseWhere, range),
      this.fetchExpenseBreakdown(expenseWhere),
      this.fetchStockInvestment(range, storeId),
    ]);

    const monthKeys = buildMonthSeries(range.fromCalendar, range.toCalendar);
    const revenueCogsExpenses = monthKeys.map((key) => {
      const sales = monthlySales.find((row) => row.month === key);
      const expenses = monthlyExpenses.find((row) => row.month === key);
      const revenue = sales?.revenue ?? 0;
      const cogs = sales?.cogs ?? 0;
      const exp = expenses?.amount ?? 0;

      return {
        month: monthLabel(key),
        monthKey: key,
        revenue,
        cogs,
        expenses: exp,
      };
    });

    const netProfitTrend = revenueCogsExpenses.map((row) => ({
      month: row.month,
      monthKey: row.monthKey,
      netProfit: netProfitMoney(row.revenue, row.cogs, row.expenses),
    }));

    return {
      period: {
        from: range.fromCalendar,
        to: range.toCalendar,
        timezone: getAppTimezone(),
      },
      summary: {
        ...summary,
        grossMarginPercent: grossMarginPercent(
          summary.grossProfit,
          summary.totalRevenue,
        ),
        stockInvestment,
      },
      expenseByCategory,
      breakdown: {
        revenue: summary.totalRevenue,
        cogs: summary.cogs,
        grossProfit: summary.grossProfit,
        expenses: summary.totalExpenses,
        netProfit: summary.netProfit,
      },
      charts: {
        revenueCogsExpenses,
        netProfitTrend,
      },
    };
  }

  private buildSaleWhere(
    range: ReportDateRange,
    storeId?: string,
    categoryId?: number,
  ): Prisma.SaleWhereInput {
    return {
      ...(storeId ? { storeId } : undefined),
      ...(categoryId ? { product: { categoryId } } : undefined),
      saleDate: { gte: range.fromDate, lte: range.toDate },
    };
  }

  private buildExpenseWhere(
    range: ReportDateRange,
    storeId?: string,
  ): Prisma.ExpenseWhereInput {
    return {
      ...(storeId ? { storeId } : undefined),
      expenseDate: { gte: range.fromDate, lte: range.toDate },
    };
  }

  private async computePeriodMetrics(
    saleWhere: Prisma.SaleWhereInput,
    expenseWhere: Prisma.ExpenseWhereInput,
  ) {
    const [salesAgg, cogs, expensesAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: saleWhere,
        _sum: { totalAmount: true, quantitySold: true },
      }),
      this.sumCogs(saleWhere),
      this.prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = toMoneyNumber(salesAgg._sum.totalAmount);
    const totalUnitsSold = salesAgg._sum.quantitySold ?? 0;
    const totalExpenses = toMoneyNumber(expensesAgg._sum.amount);
    const grossProfit = subtractMoney(salesAgg._sum.totalAmount, cogs);
    const netProfit = subtractMoney(grossProfit, expensesAgg._sum.amount);

    return {
      totalRevenue,
      totalUnitsSold,
      cogs,
      grossProfit,
      totalExpenses,
      netProfit,
    };
  }

  private async computePeriodSummary(
    saleWhere: Prisma.SaleWhereInput,
    expenseWhere: Prisma.ExpenseWhereInput,
    storeId?: string,
  ) {
    const [metrics, stockMetrics] = await Promise.all([
      this.computePeriodMetrics(saleWhere, expenseWhere),
      this.computeLiveStockMetrics(storeId),
    ]);

    return {
      ...metrics,
      currentStockValue: stockMetrics.stockValue,
      inStockBalance: stockMetrics.units,
      lowStockCount: stockMetrics.lowStockCount,
    };
  }

  private async sumCogs(where: Prisma.SaleWhereInput): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ cogs: unknown }[]>`
      SELECT COALESCE(SUM(s."quantitySold" * s."unitPurchasePrice"), 0)::numeric AS cogs
      FROM "sale" s
      ${this.buildSaleSqlFilter(where)}
    `;

    return parseRawMoney(rows[0]?.cogs);
  }

  private buildSaleSqlFilter(where: Prisma.SaleWhereInput): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`WHERE 1=1`];

    if (where.storeId && typeof where.storeId === "string") {
      parts.push(Prisma.sql`AND s."storeId" = ${where.storeId}`);
    }

    const saleDate = where.saleDate;
    if (saleDate && typeof saleDate === "object") {
      if ("gte" in saleDate && saleDate.gte) {
        parts.push(Prisma.sql`AND s."saleDate" >= ${saleDate.gte}`);
      }
      if ("lte" in saleDate && saleDate.lte) {
        parts.push(Prisma.sql`AND s."saleDate" <= ${saleDate.lte}`);
      }
    }

    const product = where.product;
    if (
      product &&
      typeof product === "object" &&
      "categoryId" in product &&
      typeof product.categoryId === "number"
    ) {
      parts.push(
        Prisma.sql`AND EXISTS (
          SELECT 1 FROM "product" p
          WHERE p.id = s."productId" AND p."categoryId" = ${product.categoryId}
        )`,
      );
    }

    return Prisma.join(parts, " ");
  }

  private async fetchMonthlySales(
    where: Prisma.SaleWhereInput,
    range: ReportDateRange,
  ): Promise<Array<{ month: string; revenue: number; cogs: number }>> {
    const rows = await this.prisma.$queryRaw<MonthlyTotalsRow[]>`
      SELECT
        to_char(date_trunc('month', s."saleDate"), 'YYYY-MM') AS month,
        COALESCE(SUM(s."totalAmount"), 0)::numeric AS revenue,
        COALESCE(SUM(s."quantitySold" * s."unitPurchasePrice"), 0)::numeric AS cogs
      FROM "sale" s
      ${this.buildSaleSqlFilter({
        ...where,
        saleDate: { gte: range.fromDate, lte: range.toDate },
      })}
      GROUP BY 1
      ORDER BY 1
    `;

    return rows.map((row) => ({
      month: row.month,
      revenue: parseRawMoney(row.revenue),
      cogs: parseRawMoney(row.cogs),
    }));
  }

  private async fetchMonthlyExpenses(
    where: Prisma.ExpenseWhereInput,
    range: ReportDateRange,
  ): Promise<Array<{ month: string; amount: number }>> {
    const storeId =
      typeof where.storeId === "string" ? where.storeId : undefined;

    const rows = await this.prisma.$queryRaw<MonthlyExpenseRow[]>`
      SELECT
        to_char(date_trunc('month', e."expenseDate"), 'YYYY-MM') AS month,
        COALESCE(SUM(e.amount), 0)::numeric AS amount
      FROM "expense" e
      WHERE e."expenseDate" >= ${range.fromDate}
        AND e."expenseDate" <= ${range.toDate}
        ${storeId ? Prisma.sql`AND e."storeId" = ${storeId}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;

    return rows.map((row) => ({
      month: row.month,
      amount: parseRawMoney(row.amount),
    }));
  }

  private async fetchExpenseBreakdown(
    where: Prisma.ExpenseWhereInput,
  ): Promise<ExpenseCategoryRow[]> {
    const grouped = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    if (grouped.length === 0) {
      return [];
    }

    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: grouped.map((row) => row.categoryId) } },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    return grouped.map((row) => ({
      categoryId: row.categoryId,
      categoryName: categoryMap.get(row.categoryId) ?? "Unknown",
      amount: toMoneyNumber(row._sum.amount),
    }));
  }

  private async fetchTopProducts(
    where: Prisma.SaleWhereInput,
  ): Promise<TopProductRow[]> {
    const grouped = await this.prisma.sale.groupBy({
      by: ["productId"],
      where,
      _sum: { quantitySold: true },
      orderBy: { _sum: { quantitySold: "desc" } },
      take: 10,
    });

    if (grouped.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((row) => row.productId) } },
      select: { id: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    return grouped.map((row) => ({
      productId: row.productId,
      productName: productMap.get(row.productId) ?? "Unknown",
      unitsSold: row._sum.quantitySold ?? 0,
    }));
  }

  private async fetchTopStores(
    where: Prisma.SaleWhereInput,
  ): Promise<TopStoreRow[]> {
    const grouped = await this.prisma.sale.groupBy({
      by: ["storeId"],
      where,
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 10,
    });

    if (grouped.length === 0) {
      return [];
    }

    const stores = await this.prisma.store.findMany({
      where: { id: { in: grouped.map((row) => row.storeId) } },
      select: { id: true, name: true },
    });
    const storeMap = new Map(stores.map((s) => [s.id, s.name]));

    return grouped.map((row) => ({
      storeId: row.storeId,
      storeName: storeMap.get(row.storeId) ?? "Unknown",
      revenue: toMoneyNumber(row._sum.totalAmount),
    }));
  }

  private async fetchRecentSales(
    where: Prisma.SaleWhereInput | { storeId: string },
  ) {
    const saleWhere: Prisma.SaleWhereInput =
      "saleDate" in where || "product" in where
        ? where
        : { storeId: where.storeId };

    return this.prisma.sale.findMany({
      where: saleWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: recentSaleInclude,
    });
  }

  private async fetchLowStock(storeId?: string): Promise<LowStockRow[]> {
    const rows = await this.prisma.$queryRaw<LowStockRow[]>`
      SELECT
        i.id AS "inventoryId",
        i."productId",
        p.name AS "productName",
        i."storeId",
        st.name AS "storeName",
        i.quantity,
        i."lowStockThreshold"
      FROM "inventory" i
      INNER JOIN "product" p ON p.id = i."productId"
      INNER JOIN "store" st ON st.id = i."storeId"
      WHERE p."isActive" = true
        AND st."isActive" = true
        AND i.quantity <= i."lowStockThreshold"
        ${storeId ? Prisma.sql`AND i."storeId" = ${storeId}` : Prisma.empty}
      ORDER BY i.quantity ASC, p.name ASC
      LIMIT 50
    `;

    return rows;
  }

  private async aggregateSales(params: {
    storeId: string;
    fromCalendar: string;
    toCalendar: string;
  }) {
    const where: Prisma.SaleWhereInput = {
      storeId: params.storeId,
      saleDate: {
        gte: calendarDateToDbDate(params.fromCalendar),
        lte: calendarDateToDbDate(params.toCalendar),
      },
    };

    const agg = await this.prisma.sale.aggregate({
      where,
      _sum: { totalAmount: true, quantitySold: true },
    });

    return {
      revenue: toMoneyNumber(agg._sum.totalAmount),
      unitsSold: agg._sum.quantitySold ?? 0,
    };
  }

  private async sumInventoryUnits(storeId: string): Promise<number> {
    const agg = await this.prisma.inventory.aggregate({
      where: {
        storeId,
        product: { isActive: true },
        store: { isActive: true },
      },
      _sum: { quantity: true },
    });

    return agg._sum.quantity ?? 0;
  }

  private async countLowStock(storeId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "inventory" i
      INNER JOIN "product" p ON p.id = i."productId"
      INNER JOIN "store" st ON st.id = i."storeId"
      WHERE i."storeId" = ${storeId}
        AND p."isActive" = true
        AND st."isActive" = true
        AND i.quantity <= i."lowStockThreshold"
    `;

    return Number(rows[0]?.count ?? 0);
  }

  private async fetchDailyRevenue(
    storeId: string,
    fromCalendar: string,
    toCalendar: string,
  ): Promise<DailyRevenueRow[]> {
    const fromDate = calendarDateToDbDate(fromCalendar);
    const toDate = calendarDateToDbDate(toCalendar);

    const rows = await this.prisma.$queryRaw<
      { date: string; revenue: unknown }[]
    >`
      SELECT
        to_char(s."saleDate", 'YYYY-MM-DD') AS date,
        COALESCE(SUM(s."totalAmount"), 0)::numeric AS revenue
      FROM "sale" s
      WHERE s."storeId" = ${storeId}
        AND s."saleDate" >= ${fromDate}
        AND s."saleDate" <= ${toDate}
      GROUP BY 1
      ORDER BY 1
    `;

    const revenueByDate = new Map(
      rows.map((row) => [row.date, parseRawMoney(row.revenue)]),
    );

    return eachCalendarDate(fromCalendar, toCalendar).map((date) => ({
      date,
      revenue: revenueByDate.get(date) ?? 0,
    }));
  }

  private async fetchProductDistribution(
    where: Prisma.SaleWhereInput,
  ): Promise<ProductDistributionRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        categoryId: number;
        categoryName: string;
        unitsSold: number;
      }>
    >`
      SELECT
        p."categoryId",
        c.name AS "categoryName",
        COALESCE(SUM(s."quantitySold"), 0)::int AS "unitsSold"
      FROM "sale" s
      INNER JOIN "product" p ON p.id = s."productId"
      INNER JOIN "category" c ON c.id = p."categoryId"
      ${this.buildSaleSqlFilter(where)}
      GROUP BY p."categoryId", c.name
      ORDER BY "unitsSold" DESC
    `;

    return this.withUnitsSoldPercents(rows);
  }

  private withUnitsSoldPercents(
    rows: Array<{
      categoryId: number;
      categoryName: string;
      unitsSold: number;
    }>,
  ): ProductDistributionRow[] {
    const total = rows.reduce((sum, row) => sum + row.unitsSold, 0);

    if (total === 0) {
      return rows.map((row) => ({ ...row, percent: 0 }));
    }

    return rows.map((row) => ({
      ...row,
      percent: Math.round((row.unitsSold / total) * 10000) / 100,
    }));
  }

  private async fetchStockByCategory(
    storeId?: string,
  ): Promise<CategoryStockRow[]> {
    const rows = await this.prisma.$queryRaw<CategoryStockRow[]>`
      SELECT
        p."categoryId",
        c.name AS "categoryName",
        COALESCE(SUM(i.quantity), 0)::int AS units
      FROM "inventory" i
      INNER JOIN "product" p ON p.id = i."productId"
      INNER JOIN "category" c ON c.id = p."categoryId"
      INNER JOIN "store" st ON st.id = i."storeId"
      WHERE p."isActive" = true
        AND st."isActive" = true
        ${storeId ? Prisma.sql`AND i."storeId" = ${storeId}` : Prisma.empty}
      GROUP BY p."categoryId", c.name
      ORDER BY units DESC
    `;

    return rows;
  }

  private async computeLiveStockMetrics(storeId?: string) {
    const rows = await this.prisma.$queryRaw<
      { stockValue: unknown; units: number; lowStockCount: number }[]
    >`
      SELECT
        COALESCE(SUM(i.quantity * p."purchasePrice"), 0)::numeric AS "stockValue",
        COALESCE(SUM(i.quantity), 0)::int AS units,
        COALESCE(SUM(CASE WHEN i.quantity <= i."lowStockThreshold" THEN 1 ELSE 0 END), 0)::int AS "lowStockCount"
      FROM "inventory" i
      INNER JOIN "product" p ON p.id = i."productId"
      INNER JOIN "store" st ON st.id = i."storeId"
      WHERE p."isActive" = true
        AND st."isActive" = true
        ${storeId ? Prisma.sql`AND i."storeId" = ${storeId}` : Prisma.empty}
    `;

    return {
      stockValue: parseRawMoney(rows[0]?.stockValue),
      units: rows[0]?.units ?? 0,
      lowStockCount: rows[0]?.lowStockCount ?? 0,
    };
  }

  private async fetchStockInvestment(
    range: ReportDateRange,
    storeId?: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: unknown }[]>`
      SELECT COALESCE(SUM(ss.quantity * ss."unitPurchasePrice"), 0)::numeric AS total
      FROM "stock_supply" ss
      WHERE ss."createdAt" >= ${range.fromTimestamp}
        AND ss."createdAt" <= ${range.toTimestamp}
        ${storeId ? Prisma.sql`AND ss."storeId" = ${storeId}` : Prisma.empty}
    `;

    return parseRawMoney(rows[0]?.total);
  }

  private requireManagerStore(user: CurrentUserPayload): string {
    if (user.role !== UserRole.branch_manager) {
      throw new ForbiddenException(
        "Only branch managers can access this dashboard",
      );
    }

    if (!user.storeId) {
      throw new ForbiddenException("No store assigned to your account");
    }

    return user.storeId;
  }
}
