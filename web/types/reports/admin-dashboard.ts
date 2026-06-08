import type { AdminPeriodComparison, ReportPeriod } from "./common";

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

export interface StockByCategoryRow {
  categoryId: number;
  categoryName: string;
  units: number;
}

export interface TopProductRow {
  productId: string;
  productName: string;
  unitsSold: number;
}

export interface TopStoreRow {
  storeId: string;
  storeName: string;
  revenue: number;
}

export interface DashboardRecentSaleProduct {
  id: string;
  name: string;
  category: {
    id: number;
    name: string;
  };
}

export interface DashboardRecentSale {
  id: string;
  quantitySold: number;
  totalAmount: number;
  saleDate: string;
  status: string;
  product: DashboardRecentSaleProduct;
  store: {
    id: string;
    name: string;
  };
  soldBy: {
    id: string;
    name: string;
    email: string;
  };
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

export interface AdminDashboardQuery {
  fromDate?: string;
  toDate?: string;
  storeId?: string;
  categoryId?: number;
}
