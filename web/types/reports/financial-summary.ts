import type { ReportPeriod } from "./common";
import type { ExpenseBreakdownRow } from "./admin-dashboard";
import type { ReportQuery } from "./query";

export interface FinancialSummaryMetrics {
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
  grossMarginPercent: number;
  stockInvestment: number;
}

export interface FinancialBreakdown {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

export interface FinancialRevenueCogsRow {
  month: string;
  monthKey: string;
  revenue: number;
  cogs: number;
  expenses: number;
}

export interface FinancialNetProfitRow {
  month: string;
  monthKey: string;
  netProfit: number;
}

export interface FinancialSummaryCharts {
  revenueCogsExpenses: FinancialRevenueCogsRow[];
  netProfitTrend: FinancialNetProfitRow[];
}

export interface FinancialSummaryResponse {
  period: ReportPeriod;
  summary: FinancialSummaryMetrics;
  expenseByCategory: ExpenseBreakdownRow[];
  breakdown: FinancialBreakdown;
  charts: FinancialSummaryCharts;
}

export type FinancialSummaryQuery = ReportQuery;
