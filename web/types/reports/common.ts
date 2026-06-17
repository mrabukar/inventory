export interface ReportPeriod {
  from: string;
  to: string;
  timezone: string;
}

export type PeriodDeltaDirection = "up" | "down" | "flat";

export interface PeriodDelta {
  /** Percent change vs previous period; null when previous value was 0. */
  percent: number | null;
  direction: PeriodDeltaDirection;
  label: string;
}

export interface AdminPeriodComparison {
  label: string;
  previousPeriod: { from: string; to: string };
  totalRevenue: PeriodDelta;
  grossProfit: PeriodDelta;
  netProfit: PeriodDelta;
  totalExpenses: PeriodDelta;
  totalUnitsSold: PeriodDelta;
}

export interface ManagerPeriodComparison {
  label: string;
  todayRevenue: PeriodDelta;
  monthRevenue: PeriodDelta;
}

export interface DashboardRecentSaleProduct {
  id: string;
  name: string;
  model: string | null;
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

export interface StockByCategoryRow {
  categoryId: number;
  categoryName: string;
  units: number;
}

export interface DailyRevenueRow {
  date: string;
  revenue: number;
}
