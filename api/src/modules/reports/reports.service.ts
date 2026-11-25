import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StoreType } from "@prisma/client";
import { CurrentUserPayload } from "../../common/decorators/current-user.decorator";
import { TenantStoreResolver } from "../../common/tenant/tenant-store-resolver.service";
import { branchScopeOf } from "../../common/utils/credit-branch.util";
import { requireOrganizationId } from "../../common/utils/require-organization-id.util";
import { orderByUpdatedAtDesc } from "../../common/utils/list-order.util";
import {
  productUnitCost,
  productUnitCostSql,
} from "../../common/utils/product-unit-cost.util";
import { requireManagerStore } from "../../common/utils/store-scope.util";
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
import { sqlInclusiveDateRange } from "../../common/utils/sql-calendar-date.util";
import {
  buildAdminPeriodComparison,
  buildManagerPeriodComparison,
} from "../../common/utils/period-comparison.util";
import { PrismaService } from "../../prisma/prisma.service";
import {
  COUNTED_SALE_STATUSES,
  STOCK_OUT_SALE_STATUSES,
  type SaleStatusValue,
} from "../sales/sale.constants";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ProductDistributionQueryDto } from "./dto/product-distribution-query.dto";
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
  productModel: string | null;
  unitsSold: number;
};
type TopStoreRow = { storeId: string; storeName: string; revenue: number };

/**
 * Which store(s) a report looks at: one store, several (every credit branch
 * together), or none (everything).
 */
type StoreFilter = string | string[] | undefined;

function prismaStoreWhere(filter: Exclude<StoreFilter, undefined>) {
  return Array.isArray(filter) ? { in: filter } : filter;
}

/** Reads a store filter back out of a Prisma `where`. */
function storeFilterFromWhere(value: unknown): StoreFilter {
  if (typeof value === "string") return value;
  const list = (value as { in?: unknown } | null | undefined)?.in;
  return Array.isArray(list) ? (list as string[]) : undefined;
}

function sqlStoreFilter(column: Prisma.Sql, filter: StoreFilter): Prisma.Sql {
  if (filter === undefined) return Prisma.empty;
  if (Array.isArray(filter)) {
    return filter.length > 0
      ? Prisma.sql`AND ${column} IN (${Prisma.join(filter)})`
      : Prisma.sql`AND FALSE`;
  }
  return Prisma.sql`AND ${column} = ${filter}`;
}
type DailyRevenueRow = { date: string; revenue: number };
type CategoryStockRow = {
  categoryId: string;
  categoryName: string;
  units: number;
};

const recentSaleInclude = {
  items: {
    include: { product: { include: { category: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  store: true,
  customer: true,
  soldBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SaleInclude;

/** Recent sales rows returned on admin/manager dashboard cards. */
const DASHBOARD_RECENT_SALES_LIMIT = 7;

/** Only approved sales count toward revenue, profit and rankings. */
const countedSaleItem: Prisma.SaleItemWhereInput = {
  sale: { status: { in: COUNTED_SALE_STATUSES } },
};

/** Raw-SQL twin of `countedSaleItem` for queries aliasing sale_item as `s`. */
const COUNTED_SALE_SQL = Prisma.sql`AND EXISTS (
  SELECT 1 FROM "sale" sa
  WHERE sa.id = s."saleId"
    AND sa.status::text IN (${Prisma.join(COUNTED_SALE_STATUSES)})
)`;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantStoreResolver: TenantStoreResolver,
  ) {}

  async getAdminDashboard(query: ReportQueryDto, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const range = resolveReportDateRange(query.fromDate, query.toDate);
    // In an organization without stores this pins to the warehouse, so a
    // credit branch's own sales (a different store) never mix into it, unless
    // the admin picks that branch to look at.
    const { storeId, creditBranch } = await this.resolveReportStore(
      user,
      query.storeId,
      true,
    );
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
      stockByCategory,
      recentSales,
    ] = await Promise.all([
      this.computePeriodSummary(
        saleWhere,
        expenseWhere,
        storeId,
        organizationId,
        range,
        creditBranch,
      ),
      this.computePeriodMetrics(
        previousSaleWhere,
        previousExpenseWhere,
        organizationId,
        previousRange,
        !creditBranch,
      ),
      this.fetchMonthlySales(saleWhere, range, organizationId, !creditBranch),
      this.fetchMonthlyExpenses(expenseWhere, range, organizationId),
      this.fetchExpenseBreakdown(expenseWhere),
      this.fetchTopProducts(
        saleWhere,
        creditBranch ? undefined : { range, categoryId },
      ),
      // Ranking is for the stores of an organization with stores, or the
      // branches together; one store has nothing to rank against.
      !storeId || Array.isArray(storeId)
        ? this.fetchTopStores(saleWhere)
        : Promise.resolve([]),
      this.fetchStockByCategory(storeId, organizationId),
      this.fetchRecentSales(saleWhere),
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
        stockByCategory,
        topProducts,
        topStores,
      },
      recentSales,
    };
  }

  async getProductDistribution(
    query: ProductDistributionQueryDto,
    user: CurrentUserPayload,
  ) {
    const organizationId = requireOrganizationId(user);
    const range = resolveReportDateRange(query.fromDate, query.toDate);
    const storeId = await this.tenantStoreResolver.resolveStoreFilter(
      user,
      query.storeId,
    );
    const categoryId = this.requireCategoryId(query.categoryId);

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });

    if (!category) {
      throw new NotFoundException(`Category with id "${categoryId}" not found`);
    }

    const saleWhere = this.buildSaleWhere(range, storeId, categoryId);
    const products = this.withUnitsSoldPercents(
      await this.fetchProductsDistribution(saleWhere),
    );
    const totalUnitsSold = products.reduce(
      (sum, row) => sum + row.unitsSold,
      0,
    );
    const trend = await this.fetchProductDistributionTrend(
      range,
      storeId,
      categoryId,
      products,
      organizationId,
    );

    return {
      period: {
        from: range.fromCalendar,
        to: range.toCalendar,
        timezone: getAppTimezone(),
      },
      filters: {
        categoryId: category.id,
        categoryName: category.name,
        storeId: storeId ?? null,
      },
      totalUnitsSold,
      products,
      trend,
    };
  }

  async getStockReport(query: ReportQueryDto, user: CurrentUserPayload) {
    const range = resolveReportDateRange(query.fromDate, query.toDate);
    const resolved = await this.resolveReportStore(user, query.storeId);
    // The stock report is for one store at a time; "all branches" doesn't apply.
    const storeId = Array.isArray(resolved.storeId)
      ? undefined
      : resolved.storeId;
    const { creditBranch, orgWarehouse, creditOrg } = resolved;
    const categoryId = query.categoryId;

    const products = await this.fetchStockReportRows(
      range,
      storeId,
      categoryId,
      creditBranch,
      { orgWarehouse, creditOrg },
    );

    const totals = products.reduce(
      (acc, row) => ({
        purchaseDevices: acc.purchaseDevices + row.purchaseDevices,
        inStock: acc.inStock + row.inStock,
        salesDevices: acc.salesDevices + row.salesDevices,
      }),
      { purchaseDevices: 0, inStock: 0, salesDevices: 0 },
    );

    return {
      period: {
        from: range.fromCalendar,
        to: range.toCalendar,
        timezone: getAppTimezone(),
      },
      filters: {
        storeId: storeId ?? null,
        categoryId: categoryId ?? null,
      },
      totals,
      products,
    };
  }

  async getManagerDashboard(user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const storeId = requireManagerStore(user);
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
      outOfStockCount,
      salesTrend,
      stockByCategory,
      recentSales,
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
      this.countLowStock(storeId, organizationId),
      this.countOutOfStock(storeId, organizationId),
      this.fetchDailyRevenue(storeId, trendStart, today, organizationId),
      this.fetchStockByCategory(storeId, organizationId),
      this.fetchRecentSales({
        storeId,
        saleDate: {
          gte: calendarDateToDbDate(today),
          lte: calendarDateToDbDate(today),
        },
      }),
    ]);

    return {
      storeId,
      summary: {
        todayRevenue: todaySales.revenue,
        todayUnitsSold: todaySales.unitsSold,
        monthRevenue: monthSales.revenue,
        inStockBalance,
        lowStockCount,
        outOfStockCount,
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
    };
  }

  /**
   * Which store a report covers, and whether it is a credit branch's own
   * business. A branch manager gets their own store; an admin gets the
   * organization's usual scope, except that an admin can open a credit
   * branch's figures by passing its store id (an organization without stores
   * otherwise pins everything to its own stock).
   */
  async resolveReportStore(
    user: CurrentUserPayload,
    queryStoreId?: string,
    // Only the dashboard and financial summary can show every credit branch together.
    allowAllBranches = false,
  ): Promise<{
    storeId: StoreFilter;
    creditBranch: boolean;
    /** The hidden store holding an organization without stores' own stock. */
    orgWarehouse: boolean;
    /** The organization's own view in a credit organization (it sells by crediting). */
    creditOrg: boolean;
  }> {
    const organizationId = requireOrganizationId(user);
    if (allowAllBranches) {
      const scope = await branchScopeOf(this.prisma, user, queryStoreId);
      if (scope.kind === "all") {
        return {
          storeId: scope.storeIds,
          creditBranch: true,
          orgWarehouse: false,
          creditOrg: false,
        };
      }
    }
    // The shared lookup lets an admin of an organization without stores pick
    // one of its credit branches, and puts a branch manager on their own store.
    const storeId = await this.tenantStoreResolver.resolveStoreFilter(
      user,
      queryStoreId,
    );
    if (!storeId) {
      return {
        storeId,
        creditBranch: false,
        orgWarehouse: false,
        creditOrg: false,
      };
    }
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { type: true, isOrgWarehouse: true },
    });
    const orgWarehouse = Boolean(store?.isOrgWarehouse);
    const org = orgWarehouse
      ? await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { usesCreditBranches: true },
        })
      : null;
    return {
      storeId,
      creditBranch: store?.type === StoreType.credit,
      orgWarehouse,
      creditOrg: Boolean(org?.usesCreditBranches),
    };
  }

  async getFinancialSummary(query: ReportQueryDto, user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const range = resolveReportDateRange(query.fromDate, query.toDate);
    const { storeId, creditBranch } = await this.resolveReportStore(
      user,
      query.storeId,
      true,
    );
    // A credit branch's view looks at expenses booked to that branch (none,
    // unless an admin booked some), not the organization's company-wide ones.
    const expenseStoreId = creditBranch
      ? storeId
      : await this.tenantStoreResolver.resolveExpenseStoreFilter(
          user,
          query.storeId,
        );

    const saleWhere = this.buildSaleWhere(range, storeId);
    const expenseWhere = this.buildExpenseWhere(range, expenseStoreId);

    const [
      summary,
      monthlySales,
      monthlyExpenses,
      expenseByCategory,
      stockInvestment,
    ] = await Promise.all([
      this.computePeriodSummary(
        saleWhere,
        expenseWhere,
        storeId,
        organizationId,
        range,
        creditBranch,
      ),
      this.fetchMonthlySales(saleWhere, range, organizationId, !creditBranch),
      this.fetchMonthlyExpenses(expenseWhere, range, organizationId),
      this.fetchExpenseBreakdown(expenseWhere),
      this.fetchStockInvestment(range, storeId, organizationId, creditBranch),
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

  /**
   * Company net profit with no date window. Uses the same store scope as
   * financial summary when no store is selected.
   */
  async getAllTimeCompanyNetProfit(user: CurrentUserPayload) {
    const organizationId = requireOrganizationId(user);
    const [storeId, expenseStoreId] = await Promise.all([
      this.tenantStoreResolver.resolveStoreFilter(user),
      this.tenantStoreResolver.resolveExpenseStoreFilter(user),
    ]);

    const saleWhere: Prisma.SaleItemWhereInput = {
      ...countedSaleItem,
      ...(storeId ? { storeId } : undefined),
    };
    const expenseWhere: Prisma.ExpenseWhereInput = {
      ...(expenseStoreId ? { storeId: expenseStoreId } : undefined),
    };

    const [salesAgg, expensesAgg, cogs, branchCredit] = await Promise.all([
      this.prisma.saleItem.aggregate({
        where: saleWhere,
        _sum: { lineTotal: true },
      }),
      this.prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
      this.sumAllTimeCogs(saleWhere, organizationId),
      this.sumBranchCreditTotals(organizationId),
    ]);

    const totalRevenue = toMoneyNumber(
      toMoneyNumber(salesAgg._sum.lineTotal) + branchCredit.revenue,
    );
    const totalExpenses = toMoneyNumber(expensesAgg._sum.amount);
    // branchCredit.revenue − branchCredit.profit is the branch credit's own cost.
    const totalCogs = toMoneyNumber(
      cogs + branchCredit.revenue - branchCredit.profit,
    );
    const grossProfit = toMoneyNumber(
      subtractMoney(salesAgg._sum.lineTotal, cogs) + branchCredit.profit,
    );
    const netProfit = subtractMoney(grossProfit, expensesAgg._sum.amount);

    return {
      netProfit,
      totalRevenue,
      cogs: totalCogs,
      grossProfit,
      totalExpenses,
    };
  }

  // Sale aggregates now run against line items (SaleItem carries denormalized
  // storeId + saleDate). Category filters match the item's product.
  private buildSaleWhere(
    range: ReportDateRange,
    storeId?: StoreFilter,
    categoryId?: string,
    statuses: SaleStatusValue[] = COUNTED_SALE_STATUSES,
  ): Prisma.SaleItemWhereInput {
    return {
      sale: { status: { in: statuses } },
      ...(storeId ? { storeId: prismaStoreWhere(storeId) } : undefined),
      ...(categoryId ? { product: { categoryId } } : undefined),
      saleDate: { gte: range.fromDate, lte: range.toDate },
    };
  }

  private buildExpenseWhere(
    range: ReportDateRange,
    storeId?: StoreFilter,
  ): Prisma.ExpenseWhereInput {
    return {
      ...(storeId ? { storeId: prismaStoreWhere(storeId) } : undefined),
      expenseDate: { gte: range.fromDate, lte: range.toDate },
    };
  }

  /** Units distributed to a store in the period (net of supply corrections). */
  private buildStockSupplyWhere(
    range: ReportDateRange,
    storeId: string,
    categoryId?: string,
  ): Prisma.StockSupplyWhereInput {
    return {
      storeId,
      ...(categoryId ? { product: { categoryId, isActive: true } } : undefined),
      createdAt: {
        gte: range.fromTimestamp,
        lte: range.toTimestamp,
      },
    };
  }

  private requireCategoryId(value: unknown): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException("categoryId must be a non-empty string");
    }

    return value;
  }

  private async computePeriodMetrics(
    saleWhere: Prisma.SaleItemWhereInput,
    expenseWhere: Prisma.ExpenseWhereInput,
    organizationId: string,
    dateRange: ReportDateRange,
    // Stock credited to credit branches is the organization's own sale. It
    // is not part of a credit branch's view of its own business.
    includeBranchCredit = true,
  ) {
    const [salesAgg, cogs, expensesAgg, branchCredit] = await Promise.all([
      this.prisma.saleItem.aggregate({
        where: saleWhere,
        _sum: { lineTotal: true, quantitySold: true },
      }),
      this.sumCogs(saleWhere, organizationId, dateRange),
      this.prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
      includeBranchCredit
        ? this.sumBranchCreditTotals(organizationId, dateRange)
        : Promise.resolve({ revenue: 0, profit: 0, units: 0 }),
    ]);

    const totalRevenue = toMoneyNumber(
      toMoneyNumber(salesAgg._sum.lineTotal) + branchCredit.revenue,
    );
    const totalUnitsSold =
      (salesAgg._sum.quantitySold ?? 0) + branchCredit.units;
    const totalExpenses = toMoneyNumber(expensesAgg._sum.amount);
    // branchCredit.revenue − branchCredit.profit is the branch credit's own cost.
    const totalCogs = toMoneyNumber(
      cogs + branchCredit.revenue - branchCredit.profit,
    );
    const grossProfit = toMoneyNumber(
      subtractMoney(salesAgg._sum.lineTotal, cogs) + branchCredit.profit,
    );
    const netProfit = subtractMoney(grossProfit, expensesAgg._sum.amount);

    return {
      totalRevenue,
      totalUnitsSold,
      cogs: totalCogs,
      grossProfit,
      totalExpenses,
      netProfit,
    };
  }

  private async computePeriodSummary(
    saleWhere: Prisma.SaleItemWhereInput,
    expenseWhere: Prisma.ExpenseWhereInput,
    storeId: StoreFilter,
    organizationId: string,
    dateRange: ReportDateRange,
    creditBranch = false,
  ) {
    const [metrics, stockMetrics] = await Promise.all([
      this.computePeriodMetrics(
        saleWhere,
        expenseWhere,
        organizationId,
        dateRange,
        !creditBranch,
      ),
      this.computeLiveStockMetrics(storeId, organizationId, creditBranch),
    ]);

    return {
      ...metrics,
      currentStockValue: stockMetrics.stockValue,
      inStockBalance: stockMetrics.units,
      lowStockCount: stockMetrics.lowStockCount,
      outOfStockCount: stockMetrics.outOfStockCount,
    };
  }

  private async sumAllTimeCogs(
    where: Prisma.SaleItemWhereInput,
    organizationId: string,
  ): Promise<number> {
    const storeId =
      typeof where.storeId === "string" ? where.storeId : undefined;

    const rows = await this.prisma.$queryRaw<{ cogs: unknown }[]>`
      SELECT COALESCE(SUM(s."quantitySold" * s."unitPurchasePrice"), 0)::numeric AS cogs
      FROM "sale_item" s
      WHERE s."organizationId" = ${organizationId}
      ${storeId ? Prisma.sql`AND s."storeId" = ${storeId}` : Prisma.empty}
      ${COUNTED_SALE_SQL}
    `;

    return parseRawMoney(rows[0]?.cogs);
  }

  /**
   * Stock credited to credit branches is the organization's own sale
   * (revenue = the price charged, cost = the org's cost at credit time). A
   * return reverses both, in the period the return happens (not the
   * original credit's period). A credit branch's own resale to its
   * customers is excluded from the org's reports by storeId — see
   * resolveStoreFilter — so nothing here double-counts it.
   */
  private async sumBranchCreditTotals(
    organizationId: string,
    dateRange?: ReportDateRange,
  ): Promise<{ revenue: number; profit: number; units: number }> {
    const createdAt = dateRange
      ? { gte: dateRange.fromTimestamp, lte: dateRange.toTimestamp }
      : undefined;

    const [itemsAgg, returnsAgg, costCreditedRows, costReturnedRows] =
      await Promise.all([
        this.prisma.branchCreditItem.aggregate({
          where: { organizationId, ...(createdAt ? { createdAt } : undefined) },
          _sum: { lineTotal: true, quantity: true },
        }),
        this.prisma.branchReturn.aggregate({
          where: { organizationId, ...(createdAt ? { createdAt } : undefined) },
          _sum: { amount: true, quantity: true },
        }),
        this.prisma.$queryRaw<{ cost: unknown }[]>`
          SELECT COALESCE(SUM(i.quantity * i."unitCost"), 0)::numeric AS cost
          FROM "branch_credit_item" i
          WHERE i."organizationId" = ${organizationId}
          ${
            createdAt
              ? Prisma.sql`AND i."createdAt" BETWEEN ${createdAt.gte} AND ${createdAt.lte}`
              : Prisma.empty
          }
        `,
        this.prisma.$queryRaw<{ cost: unknown }[]>`
          SELECT COALESCE(SUM(r.quantity * i."unitCost"), 0)::numeric AS cost
          FROM "branch_return" r
          INNER JOIN "branch_credit_item" i ON i.id = r."branchCreditItemId"
          WHERE r."organizationId" = ${organizationId}
          ${
            createdAt
              ? Prisma.sql`AND r."createdAt" BETWEEN ${createdAt.gte} AND ${createdAt.lte}`
              : Prisma.empty
          }
        `,
      ]);

    const revenue = toMoneyNumber(
      toMoneyNumber(itemsAgg._sum.lineTotal) -
        toMoneyNumber(returnsAgg._sum.amount),
    );
    const cost = toMoneyNumber(
      parseRawMoney(costCreditedRows[0]?.cost) -
        parseRawMoney(costReturnedRows[0]?.cost),
    );
    const profit = toMoneyNumber(revenue - cost);
    // Units credited to branches, less what they sent back, count as sold.
    const units =
      (itemsAgg._sum.quantity ?? 0) - (returnsAgg._sum.quantity ?? 0);

    return { revenue, profit, units };
  }

  private async sumCogs(
    where: Prisma.SaleItemWhereInput,
    organizationId: string,
    dateRange: ReportDateRange,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ cogs: unknown }[]>`
      SELECT COALESCE(SUM(s."quantitySold" * s."unitPurchasePrice"), 0)::numeric AS cogs
      FROM "sale_item" s
      ${this.buildSaleSqlFilter(where, organizationId, dateRange)}
    `;

    return parseRawMoney(rows[0]?.cogs);
  }

  private buildSaleSqlFilter(
    where: Prisma.SaleItemWhereInput,
    organizationId: string,
    dateRange: ReportDateRange,
  ): Prisma.Sql {
    const parts: Prisma.Sql[] = [
      Prisma.sql`WHERE 1=1`,
      Prisma.sql`AND s."organizationId" = ${organizationId}`,
      COUNTED_SALE_SQL,
      Prisma.sql`AND ${sqlInclusiveDateRange(
        Prisma.sql`s."saleDate"`,
        dateRange.fromCalendar,
        dateRange.toCalendar,
      )}`,
    ];

    const storeFilter = storeFilterFromWhere(where.storeId);
    if (storeFilter !== undefined) {
      parts.push(sqlStoreFilter(Prisma.sql`s."storeId"`, storeFilter));
    }

    const product = where.product;
    if (
      product &&
      typeof product === "object" &&
      "categoryId" in product &&
      typeof product.categoryId === "string"
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

  /** Revenue and cost per month from sales, plus stock credited to branches when asked. */
  private async fetchMonthlySales(
    where: Prisma.SaleItemWhereInput,
    range: ReportDateRange,
    organizationId: string,
    includeBranchCredit = false,
  ): Promise<Array<{ month: string; revenue: number; cogs: number }>> {
    const sales = await this.fetchMonthlySaleRows(where, range, organizationId);
    if (!includeBranchCredit) {
      return sales;
    }

    const merged = new Map(sales.map((row) => [row.month, { ...row }]));
    for (const row of await this.fetchMonthlyBranchCredit(
      range,
      organizationId,
    )) {
      const entry = merged.get(row.month) ?? {
        month: row.month,
        revenue: 0,
        cogs: 0,
      };
      entry.revenue = toMoneyNumber(entry.revenue + row.revenue);
      entry.cogs = toMoneyNumber(entry.cogs + row.cogs);
      merged.set(row.month, entry);
    }
    return [...merged.values()].sort((a, b) => a.month.localeCompare(b.month));
  }

  /** Stock credited to branches per month (what was charged and what it cost), net of returns. */
  private async fetchMonthlyBranchCredit(
    range: ReportDateRange,
    organizationId: string,
  ): Promise<Array<{ month: string; revenue: number; cogs: number }>> {
    const timezone = getAppTimezone();
    const [credited, returned] = await Promise.all([
      this.prisma.$queryRaw<MonthlyTotalsRow[]>`
        SELECT
          to_char(date_trunc('month', (i."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}), 'YYYY-MM') AS month,
          COALESCE(SUM(i."lineTotal"), 0)::numeric AS revenue,
          COALESCE(SUM(i.quantity * i."unitCost"), 0)::numeric AS cogs
        FROM "branch_credit_item" i
        WHERE i."organizationId" = ${organizationId}
          AND i."createdAt" BETWEEN ${range.fromTimestamp} AND ${range.toTimestamp}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<MonthlyTotalsRow[]>`
        SELECT
          to_char(date_trunc('month', (r."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}), 'YYYY-MM') AS month,
          COALESCE(SUM(r.amount), 0)::numeric AS revenue,
          COALESCE(SUM(r.quantity * i."unitCost"), 0)::numeric AS cogs
        FROM "branch_return" r
        INNER JOIN "branch_credit_item" i ON i.id = r."branchCreditItemId"
        WHERE r."organizationId" = ${organizationId}
          AND r."createdAt" BETWEEN ${range.fromTimestamp} AND ${range.toTimestamp}
        GROUP BY 1
      `,
    ]);

    const months = new Map<
      string,
      { month: string; revenue: number; cogs: number }
    >();
    const add = (rows: MonthlyTotalsRow[], sign: 1 | -1) => {
      for (const row of rows) {
        const entry = months.get(row.month) ?? {
          month: row.month,
          revenue: 0,
          cogs: 0,
        };
        entry.revenue = toMoneyNumber(
          entry.revenue + sign * parseRawMoney(row.revenue),
        );
        entry.cogs = toMoneyNumber(entry.cogs + sign * parseRawMoney(row.cogs));
        months.set(row.month, entry);
      }
    };
    add(credited, 1);
    add(returned, -1);
    return [...months.values()];
  }

  /** Units credited to branches per product in the period, less returns. */
  private async fetchBranchCreditedUnits(
    range: ReportDateRange,
    categoryId?: string,
  ): Promise<Map<string, number>> {
    const createdAt = { gte: range.fromTimestamp, lte: range.toTimestamp };
    const product = categoryId
      ? { categoryId, isActive: true as const }
      : { isActive: true as const };

    const [credited, returned] = await Promise.all([
      this.prisma.branchCreditItem.groupBy({
        by: ["productId"],
        where: { createdAt, product },
        _sum: { quantity: true },
      }),
      this.prisma.branchReturn.findMany({
        where: { createdAt, branchCreditItem: { product } },
        select: {
          quantity: true,
          branchCreditItem: { select: { productId: true } },
        },
      }),
    ]);

    const net = new Map<string, number>();
    for (const row of credited) {
      net.set(row.productId, row._sum?.quantity ?? 0);
    }
    for (const row of returned) {
      const productId = row.branchCreditItem.productId;
      net.set(productId, (net.get(productId) ?? 0) - row.quantity);
    }
    return net;
  }

  private async fetchMonthlySaleRows(
    where: Prisma.SaleItemWhereInput,
    range: ReportDateRange,
    organizationId: string,
  ): Promise<Array<{ month: string; revenue: number; cogs: number }>> {
    const rows = await this.prisma.$queryRaw<MonthlyTotalsRow[]>`
      SELECT
        to_char(date_trunc('month', s."saleDate"), 'YYYY-MM') AS month,
        COALESCE(SUM(s."lineTotal"), 0)::numeric AS revenue,
        COALESCE(SUM(s."quantitySold" * s."unitPurchasePrice"), 0)::numeric AS cogs
      FROM "sale_item" s
      ${this.buildSaleSqlFilter(where, organizationId, range)}
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
    organizationId: string,
  ): Promise<Array<{ month: string; amount: number }>> {
    const storeId = storeFilterFromWhere(where.storeId);

    const rows = await this.prisma.$queryRaw<MonthlyExpenseRow[]>`
      SELECT
        to_char(date_trunc('month', e."expenseDate"), 'YYYY-MM') AS month,
        COALESCE(SUM(e.amount), 0)::numeric AS amount
      FROM "expense" e
      WHERE ${sqlInclusiveDateRange(
        Prisma.sql`e."expenseDate"`,
        range.fromCalendar,
        range.toCalendar,
      )}
        AND e."organizationId" = ${organizationId}
        ${sqlStoreFilter(Prisma.sql`e."storeId"`, storeId)}
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
    where: Prisma.SaleItemWhereInput,
    // Stock credited to branches counts as sold (the organization's own view).
    credited?: { range: ReportDateRange; categoryId?: string },
  ): Promise<TopProductRow[]> {
    const grouped = await this.prisma.saleItem.groupBy({
      by: ["productId"],
      where,
      _sum: { quantitySold: true },
    });

    const units = new Map<string, number>(
      grouped.map((row) => [row.productId, row._sum.quantitySold ?? 0]),
    );
    if (credited) {
      const net = await this.fetchBranchCreditedUnits(
        credited.range,
        credited.categoryId,
      );
      for (const [productId, count] of net) {
        units.set(productId, (units.get(productId) ?? 0) + count);
      }
    }

    const top = [...units.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (top.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: top.map(([productId]) => productId) } },
      select: { id: true, name: true, model: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return top.map(([productId, unitsSold]) => {
      const product = productMap.get(productId);
      return {
        productId,
        productName: product?.name ?? "Unknown",
        productModel: product?.model ?? null,
        unitsSold,
      };
    });
  }

  private async fetchTopStores(
    where: Prisma.SaleItemWhereInput,
  ): Promise<TopStoreRow[]> {
    const grouped = await this.prisma.saleItem.groupBy({
      by: ["storeId"],
      where,
      _sum: { lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
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
      revenue: toMoneyNumber(row._sum.lineTotal),
    }));
  }

  private async fetchRecentSales(itemWhere: Prisma.SaleItemWhereInput) {
    // Translate the item-level filter into a Sale header filter.
    const saleWhere: Prisma.SaleWhereInput = {
      status: { in: COUNTED_SALE_STATUSES },
      ...(itemWhere.storeId
        ? { storeId: itemWhere.storeId as Prisma.SaleWhereInput["storeId"] }
        : undefined),
      ...(itemWhere.saleDate
        ? { saleDate: itemWhere.saleDate as Prisma.DateTimeFilter<"Sale"> }
        : undefined),
      ...(itemWhere.product
        ? { items: { some: { product: itemWhere.product } } }
        : undefined),
    };

    return this.prisma.sale.findMany({
      where: saleWhere,
      orderBy: orderByUpdatedAtDesc,
      take: DASHBOARD_RECENT_SALES_LIMIT,
      include: recentSaleInclude,
    });
  }

  private async aggregateSales(params: {
    storeId: string;
    fromCalendar: string;
    toCalendar: string;
  }) {
    const where: Prisma.SaleItemWhereInput = {
      ...countedSaleItem,
      storeId: params.storeId,
      saleDate: {
        gte: calendarDateToDbDate(params.fromCalendar),
        lte: calendarDateToDbDate(params.toCalendar),
      },
    };

    const agg = await this.prisma.saleItem.aggregate({
      where,
      _sum: { lineTotal: true, quantitySold: true },
    });

    return {
      revenue: toMoneyNumber(agg._sum.lineTotal),
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

  private async countLowStock(
    storeId: string,
    organizationId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "inventory" i
      INNER JOIN "product" p ON p.id = i."productId"
      INNER JOIN "store" st ON st.id = i."storeId"
      WHERE i."storeId" = ${storeId}
        AND i."organizationId" = ${organizationId}
        AND p."isActive" = true
        AND st."isActive" = true
        AND i.quantity > 0
        AND i.quantity <= i."lowStockThreshold"
    `;

    return Number(rows[0]?.count ?? 0);
  }

  private async countOutOfStock(
    storeId: string,
    organizationId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "inventory" i
      INNER JOIN "product" p ON p.id = i."productId"
      INNER JOIN "store" st ON st.id = i."storeId"
      WHERE i."storeId" = ${storeId}
        AND i."organizationId" = ${organizationId}
        AND p."isActive" = true
        AND st."isActive" = true
        AND i.quantity = 0
    `;

    return Number(rows[0]?.count ?? 0);
  }

  private async fetchDailyRevenue(
    storeId: string,
    fromCalendar: string,
    toCalendar: string,
    organizationId: string,
  ): Promise<DailyRevenueRow[]> {
    const rows = await this.prisma.$queryRaw<
      { date: string; revenue: unknown }[]
    >`
      SELECT
        to_char(s."saleDate", 'YYYY-MM-DD') AS date,
        COALESCE(SUM(s."lineTotal"), 0)::numeric AS revenue
      FROM "sale_item" s
      WHERE s."storeId" = ${storeId}
        AND s."organizationId" = ${organizationId}
        ${COUNTED_SALE_SQL}
        AND ${sqlInclusiveDateRange(
          Prisma.sql`s."saleDate"`,
          fromCalendar,
          toCalendar,
        )}
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

  private async fetchProductDistributionTrend(
    range: ReportDateRange,
    storeId: string | undefined,
    categoryId: string,
    products: Array<{
      productId: string;
      productName: string;
      productModel: string | null;
    }>,
    organizationId: string,
  ) {
    const dates = eachCalendarDate(range.fromCalendar, range.toCalendar);
    const productIds = products.map((row) => row.productId);

    if (productIds.length === 0) {
      return {
        dates,
        series: [] as Array<{
          productId: string;
          productName: string;
          productModel: string | null;
          values: number[];
        }>,
      };
    }

    const rows = await this.prisma.$queryRaw<
      { productId: string; date: string; units: number }[]
    >`
      SELECT
        s."productId",
        to_char(s."saleDate", 'YYYY-MM-DD') AS date,
        COALESCE(SUM(s."quantitySold"), 0)::int AS units
      FROM "sale_item" s
      INNER JOIN "product" p ON p.id = s."productId"
      WHERE ${sqlInclusiveDateRange(
        Prisma.sql`s."saleDate"`,
        range.fromCalendar,
        range.toCalendar,
      )}
        AND s."organizationId" = ${organizationId}
        AND p."categoryId" = ${categoryId}
        ${storeId ? Prisma.sql`AND s."storeId" = ${storeId}` : Prisma.empty}
        AND s."productId" IN (${Prisma.join(productIds)})
        ${COUNTED_SALE_SQL}
      GROUP BY 1, 2
      ORDER BY 2, 1
    `;

    const unitsByProduct = new Map<string, Map<string, number>>();
    for (const row of rows) {
      if (!unitsByProduct.has(row.productId)) {
        unitsByProduct.set(row.productId, new Map());
      }
      unitsByProduct.get(row.productId)!.set(row.date, row.units);
    }

    return {
      dates,
      series: products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        productModel: product.productModel,
        values: dates.map(
          (date) => unitsByProduct.get(product.productId)?.get(date) ?? 0,
        ),
      })),
    };
  }

  private async fetchProductsDistribution(
    where: Prisma.SaleItemWhereInput,
  ): Promise<
    Array<{
      productId: string;
      productName: string;
      productModel: string | null;
      unitsSold: number;
    }>
  > {
    const grouped = await this.prisma.saleItem.groupBy({
      by: ["productId"],
      where,
      _sum: { quantitySold: true },
      orderBy: { _sum: { quantitySold: "desc" } },
    });

    if (grouped.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((row) => row.productId) } },
      select: { id: true, name: true, model: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return grouped.map((row) => {
      const product = productMap.get(row.productId);
      return {
        productId: row.productId,
        productName: product?.name ?? "Unknown",
        productModel: product?.model ?? null,
        unitsSold: row._sum.quantitySold ?? 0,
      };
    });
  }

  private withUnitsSoldPercents<T extends { unitsSold: number }>(
    rows: T[],
  ): Array<T & { percent: number }> {
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
    storeId: StoreFilter,
    organizationId: string,
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
        AND i."organizationId" = ${organizationId}
        AND c."organizationId" = ${organizationId}
        ${sqlStoreFilter(Prisma.sql`i."storeId"`, storeId)}
      GROUP BY p."categoryId", c.name
      ORDER BY units DESC
    `;

    return rows;
  }

  private async computeLiveStockMetrics(
    storeId: StoreFilter,
    organizationId: string,
    creditBranch = false,
  ) {
    // A credit branch's stock is worth what it paid for it: the prices it was
    // credited at, averaged, with returned units taken out.
    const useBranchCost = creditBranch && Boolean(storeId);
    const unitCost = useBranchCost
      ? Prisma.sql`COALESCE(bc.avg_cost, ${productUnitCostSql})`
      : productUnitCostSql;
    const branchCostJoin = useBranchCost
      ? Prisma.sql`LEFT JOIN (
          SELECT
            ci."storeId",
            ci."productId",
            SUM((ci.quantity - COALESCE(r.returned, 0)) * ci."unitPrice")
              / NULLIF(SUM(ci.quantity - COALESCE(r.returned, 0)), 0) AS avg_cost
          FROM "branch_credit_item" ci
          LEFT JOIN (
            SELECT "branchCreditItemId", SUM(quantity) AS returned
            FROM "branch_return"
            GROUP BY "branchCreditItemId"
          ) r ON r."branchCreditItemId" = ci.id
          WHERE TRUE ${sqlStoreFilter(Prisma.sql`ci."storeId"`, storeId)}
          GROUP BY ci."storeId", ci."productId"
        ) bc ON bc."productId" = p.id AND bc."storeId" = i."storeId"`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      {
        stockValue: unknown;
        units: number;
        lowStockCount: number;
        outOfStockCount: number;
      }[]
    >`
      SELECT
        COALESCE(SUM(i.quantity * ${unitCost}), 0)::numeric AS "stockValue",
        COALESCE(SUM(i.quantity), 0)::int AS units,
        COALESCE(SUM(CASE WHEN i.quantity > 0 AND i.quantity <= i."lowStockThreshold" THEN 1 ELSE 0 END), 0)::int AS "lowStockCount",
        COALESCE(SUM(CASE WHEN i.quantity = 0 THEN 1 ELSE 0 END), 0)::int AS "outOfStockCount"
      FROM "inventory" i
      INNER JOIN "product" p ON p.id = i."productId"
      INNER JOIN "store" st ON st.id = i."storeId"
      ${branchCostJoin}
      WHERE p."isActive" = true
        AND st."isActive" = true
        AND i."organizationId" = ${organizationId}
        ${sqlStoreFilter(Prisma.sql`i."storeId"`, storeId)}
    `;

    return {
      stockValue: parseRawMoney(rows[0]?.stockValue),
      units: rows[0]?.units ?? 0,
      lowStockCount: rows[0]?.lowStockCount ?? 0,
      outOfStockCount: rows[0]?.outOfStockCount ?? 0,
    };
  }

  private async fetchStockInvestment(
    range: ReportDateRange,
    storeId: StoreFilter,
    organizationId: string,
    creditBranch = false,
  ): Promise<number> {
    // A credit branch's "investment" is the stock it bought from the
    // organization in the period (what it was charged), less what it returned.
    if (creditBranch && storeId) {
      const createdAt = {
        gte: range.fromTimestamp,
        lte: range.toTimestamp,
      };
      const [credited, returned] = await Promise.all([
        this.prisma.branchCredit.aggregate({
          where: { storeId: prismaStoreWhere(storeId), createdAt },
          _sum: { total: true },
        }),
        this.prisma.branchReturn.aggregate({
          where: { storeId: prismaStoreWhere(storeId), createdAt },
          _sum: { amount: true },
        }),
      ]);
      return toMoneyNumber(
        toMoneyNumber(credited._sum.total) -
          toMoneyNumber(returned._sum.amount),
      );
    }

    const rows = await this.prisma.$queryRaw<{ total: unknown }[]>`
      SELECT COALESCE(SUM(p."totalCost"), 0)::numeric AS total
      FROM "purchase" p
      WHERE ${sqlInclusiveDateRange(
        Prisma.sql`p."purchaseDate"`,
        range.fromCalendar,
        range.toCalendar,
      )}
        AND p."organizationId" = ${organizationId}
    `;

    return parseRawMoney(rows[0]?.total);
  }

  /** Units a credit branch received in the period, less what it sent back. */
  private async fetchBranchStockBought(
    range: ReportDateRange,
    storeId: string,
    categoryId?: string,
  ): Promise<Array<{ productId: string; _sum: { quantity: number | null } }>> {
    const createdAt = { gte: range.fromTimestamp, lte: range.toTimestamp };
    const product = categoryId
      ? { categoryId, isActive: true as const }
      : { isActive: true as const };

    const [credited, returned] = await Promise.all([
      this.prisma.branchCreditItem.groupBy({
        by: ["productId"],
        where: { storeId, createdAt, product },
        _sum: { quantity: true },
      }),
      this.prisma.branchReturn.findMany({
        where: { storeId, createdAt, branchCreditItem: { product } },
        select: {
          quantity: true,
          branchCreditItem: { select: { productId: true } },
        },
      }),
    ]);

    const net = new Map<string, number>();
    for (const row of credited) {
      net.set(row.productId, row._sum.quantity ?? 0);
    }
    for (const row of returned) {
      const productId = row.branchCreditItem.productId;
      net.set(productId, (net.get(productId) ?? 0) - row.quantity);
    }
    return [...net.entries()].map(([productId, quantity]) => ({
      productId,
      _sum: { quantity },
    }));
  }

  /** What a credit branch pays per unit, by product: its credit prices net of returns. */
  private async fetchBranchUnitCosts(
    storeId: string,
    productIds: string[],
  ): Promise<Map<string, number>> {
    const lines = await this.prisma.branchCreditItem.findMany({
      where: { storeId, productId: { in: productIds } },
      select: {
        productId: true,
        quantity: true,
        unitPrice: true,
        returns: { select: { quantity: true } },
      },
    });

    const totals = new Map<string, { units: number; value: number }>();
    for (const line of lines) {
      const returned = line.returns.reduce((sum, r) => sum + r.quantity, 0);
      const kept = line.quantity - returned;
      const entry = totals.get(line.productId) ?? { units: 0, value: 0 };
      entry.units += kept;
      entry.value += kept * Number(line.unitPrice);
      totals.set(line.productId, entry);
    }

    const costs = new Map<string, number>();
    for (const [productId, { units, value }] of totals) {
      if (units > 0) {
        costs.set(productId, toMoneyNumber(value / units));
      }
    }
    return costs;
  }

  private async fetchStockReportRows(
    range: ReportDateRange,
    storeId?: string,
    categoryId?: string,
    creditBranch = false,
    org: { orgWarehouse: boolean; creditOrg: boolean } = {
      orgWarehouse: false,
      creditOrg: false,
    },
  ): Promise<
    Array<{
      productId: string;
      productName: string;
      productModel: string | null;
      averageCost: number;
      purchaseDevices: number;
      inStock: number;
      salesDevices: number;
    }>
  > {
    const productFilter = categoryId
      ? { categoryId, isActive: true as const }
      : { isActive: true as const };

    const [purchaseRows, salesRows, inventoryRows] = await Promise.all([
      creditBranch && storeId
        ? // A credit branch is not supplied from the warehouse: it buys stock
          // from the organization, and returns some of it back.
          this.fetchBranchStockBought(range, storeId, categoryId)
        : // An organization without stores buys into its own warehouse and
          // distributes nothing, so what it bought comes from purchases.
          storeId && !org.orgWarehouse
          ? this.prisma.stockSupply.groupBy({
              by: ["productId"],
              where: this.buildStockSupplyWhere(range, storeId, categoryId),
              _sum: { quantity: true },
            })
          : this.prisma.purchase.groupBy({
              by: ["productId"],
              where: {
                product: productFilter,
                purchaseDate: {
                  gte: range.fromDate,
                  lte: range.toDate,
                },
              },
              _sum: { quantity: true },
            }),
      this.prisma.saleItem.groupBy({
        by: ["productId"],
        // Stock report reconciles with shelf counts, so pending sales count.
        where: this.buildSaleWhere(
          range,
          storeId,
          categoryId,
          STOCK_OUT_SALE_STATUSES,
        ),
        _sum: { quantitySold: true },
      }),
      this.prisma.inventory.groupBy({
        by: ["productId"],
        where: {
          ...(storeId ? { storeId } : undefined),
          store: { isActive: true },
          product: productFilter,
        },
        _sum: { quantity: true },
      }),
    ]);

    const purchaseByProduct = new Map(
      purchaseRows.map((row) => [row.productId, row._sum.quantity ?? 0]),
    );
    const salesByProduct = new Map(
      salesRows.map((row) => [row.productId, row._sum.quantitySold ?? 0]),
    );
    // A credit organization sells by crediting stock to its branches.
    if (org.creditOrg && !creditBranch) {
      for (const [productId, count] of await this.fetchBranchCreditedUnits(
        range,
        categoryId,
      )) {
        salesByProduct.set(
          productId,
          (salesByProduct.get(productId) ?? 0) + count,
        );
      }
    }
    const stockByProduct = new Map(
      inventoryRows.map((row) => [row.productId, row._sum.quantity ?? 0]),
    );

    let productIds: string[];
    if (categoryId) {
      const categoryProducts = await this.prisma.product.findMany({
        where: { categoryId, isActive: true },
        select: { id: true },
      });
      productIds = categoryProducts.map((row) => row.id);
    } else {
      productIds = [
        ...new Set([
          ...purchaseByProduct.keys(),
          ...salesByProduct.keys(),
          ...stockByProduct.keys(),
        ]),
      ].filter((id) => {
        const purchase = purchaseByProduct.get(id) ?? 0;
        const sales = salesByProduct.get(id) ?? 0;
        const stock = stockByProduct.get(id) ?? 0;
        return purchase !== 0 || sales !== 0 || stock !== 0;
      });
    }

    if (productIds.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, model: true, averageCost: true },
      orderBy: orderByUpdatedAtDesc,
    });

    // A credit branch's cost is what it paid the organization.
    const branchCosts =
      creditBranch && storeId
        ? await this.fetchBranchUnitCosts(
            storeId,
            products.map((product) => product.id),
          )
        : null;

    return products.map((product) => ({
      productId: product.id,
      productName: product.name,
      productModel: product.model,
      averageCost: branchCosts?.get(product.id) ?? productUnitCost(product),
      purchaseDevices: purchaseByProduct.get(product.id) ?? 0,
      inStock: stockByProduct.get(product.id) ?? 0,
      salesDevices: salesByProduct.get(product.id) ?? 0,
    }));
  }
}
