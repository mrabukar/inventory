type StockReportData = Awaited<
  ReturnType<import("../reports.service").ReportsService["getStockReport"]>
>;

export const STOCK_EMPTY_NOTICE =
  "No product activity found for the selected filters.";

export function hasStockActivity(data: StockReportData): boolean {
  return data.products.length > 0;
}

export function productLabel(
  row: StockReportData["products"][number],
): string {
  return row.productModel
    ? `${row.productName} (${row.productModel})`
    : row.productName;
}

export interface StockSummaryMetric {
  label: string;
  value: number;
}

export function buildStockSummaryMetrics(
  data: StockReportData,
): StockSummaryMetric[] {
  return [
    { label: "Total Purchased (units)", value: data.totals.purchaseDevices },
    { label: "Total In Stock (units)", value: data.totals.inStock },
    { label: "Total Sold (units)", value: data.totals.salesDevices },
    { label: "Products listed", value: data.products.length },
  ];
}
