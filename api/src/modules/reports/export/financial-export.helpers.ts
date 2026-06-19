import type { ReportExportContext } from "./report-export.types";
import { buildExportMetaRows } from "./report-export-meta.helpers";

type FinancialSummaryData = Awaited<
  ReturnType<
    import("../reports.service").ReportsService["getFinancialSummary"]
  >
>;

export const FINANCIAL_EMPTY_NOTICE =
  "No sales or expenses were recorded in this period.";

export function hasFinancialActivity(data: FinancialSummaryData): boolean {
  const { summary: s } = data;
  return (
    s.totalRevenue > 0 ||
    s.totalExpenses > 0 ||
    s.totalUnitsSold > 0 ||
    s.stockInvestment > 0 ||
    data.expenseByCategory.length > 0
  );
}

export function hasMonthlyActivity(data: FinancialSummaryData): boolean {
  return data.charts.revenueCogsExpenses.some(
    (row) => row.revenue > 0 || row.cogs > 0 || row.expenses > 0,
  );
}

export function buildFinancialMetaRows(
  context: ReportExportContext,
): Array<[string, string]> {
  return buildExportMetaRows(context);
}

export type SummaryMetricKind = "money" | "integer" | "percent" | "text";

export interface SummaryMetricRow {
  label: string;
  kind: SummaryMetricKind;
  value: number | string;
}

export function buildSummaryMetrics(
  data: FinancialSummaryData,
): SummaryMetricRow[] {
  const { summary: s } = data;
  return [
    { label: "Total Revenue", kind: "money", value: s.totalRevenue },
    { label: "Units Sold", kind: "integer", value: s.totalUnitsSold },
    { label: "Cost of Goods Sold", kind: "money", value: s.cogs },
    { label: "Gross Profit", kind: "money", value: s.grossProfit },
    { label: "Gross Margin", kind: "percent", value: s.grossMarginPercent },
    { label: "Total Expenses", kind: "money", value: s.totalExpenses },
    { label: "Net Profit", kind: "money", value: s.netProfit },
    { label: "Stock Capital Invested", kind: "money", value: s.stockInvestment },
    { label: "Current Stock Value", kind: "money", value: s.currentStockValue },
    { label: "In-Stock Units", kind: "integer", value: s.inStockBalance },
    { label: "Low Stock Count", kind: "integer", value: s.lowStockCount },
    { label: "Out of Stock Count", kind: "integer", value: s.outOfStockCount },
  ];
}
