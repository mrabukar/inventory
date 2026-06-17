import type {
  AdminPeriodComparison,
  DashboardRecentSale,
  ReportPeriod,
  StockByCategoryRow,
} from "./common";
import type { ReportQuery } from "./query";

export interface AdminDashboardSummary {
  totalRevenue: number;
  totalUnitsSold: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  currentStockValue: number;
  inStockBalance: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface MonthlyRevenueRow {
  month: string;
  monthKey: string;
  revenue: number;
  cogs: number;
  expenses: number;
  netProfit: number;
}

export interface NetProfitTrendRow {
  month: string;
  monthKey: string;
  netProfit: number;
}

export interface ExpenseBreakdownRow {
  categoryId: number;
  categoryName: string;
  amount: number;
}

export interface TopProductRow {
  productId: string;
  productName: string;
  productModel: string | null;
  unitsSold: number;
}

export interface TopStoreRow {
  storeId: string;
  storeName: string;
  revenue: number;
}

export interface AdminDashboardCharts {
  revenueCogsExpenses: MonthlyRevenueRow[];
  netProfitTrend: NetProfitTrendRow[];
  expenseBreakdown: ExpenseBreakdownRow[];
  stockByCategory: StockByCategoryRow[];
  topProducts: TopProductRow[];
  topStores: TopStoreRow[];
}

export interface AdminDashboardResponse {
  period: ReportPeriod;
  summary: AdminDashboardSummary;
  comparison: AdminPeriodComparison;
  charts: AdminDashboardCharts;
  recentSales: DashboardRecentSale[];
}

export interface AdminDashboardQuery extends ReportQuery {
  categoryId?: number;
}

export type { DashboardRecentSale } from "./common";
