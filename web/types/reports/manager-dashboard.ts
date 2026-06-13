import type {
  DailyRevenueRow,
  DashboardRecentSale,
  ManagerPeriodComparison,
  StockByCategoryRow,
} from "./common";

export interface ManagerDashboardSummary {
  todayRevenue: number;
  todayUnitsSold: number;
  monthRevenue: number;
  inStockBalance: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface ManagerDashboardCharts {
  salesTrend: DailyRevenueRow[];
  stockByCategory: StockByCategoryRow[];
}

export interface ManagerDashboardResponse {
  storeId: string;
  summary: ManagerDashboardSummary;
  comparison: ManagerPeriodComparison;
  charts: ManagerDashboardCharts;
  recentSales: DashboardRecentSale[];
}

export type {
  DailyRevenueRow,
  DashboardRecentSale,
  ManagerPeriodComparison,
  StockByCategoryRow,
} from "./common";
