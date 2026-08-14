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

export interface DashboardRecentSaleItem {
  id: string;
  quantitySold: number;
  unitPrice: number | string;
  lineTotal: number | string;
  product: DashboardRecentSaleProduct;
}

export interface DashboardRecentSale {
  id: string;
  totalAmount: number | string;
  saleDate: string;
  status: string;
  items: DashboardRecentSaleItem[];
  customer: { id: string; name: string } | null;
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

/** Total units across a recent sale's line items. */
export function dashboardSaleUnits(sale: DashboardRecentSale): number {
  return sale.items.reduce((sum, item) => sum + item.quantitySold, 0);
}

/** Compact product summary, e.g. "iPhone 15 +2 more". */
export function dashboardSaleProductSummary(sale: DashboardRecentSale): string {
  if (sale.items.length === 0) return "—";
  const [first, ...rest] = sale.items;
  return rest.length > 0
    ? `${first.product.name} +${rest.length} more`
    : first.product.name;
}

export interface StockByCategoryRow {
  categoryId: string;
  categoryName: string;
  units: number;
}

export interface DailyRevenueRow {
  date: string;
  revenue: number;
}
