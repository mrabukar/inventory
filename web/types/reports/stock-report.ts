import type { ReportPeriod } from "./common";
import type { ReportQuery } from "./query";

export interface StockReportProduct {
  productId: string;
  productName: string;
  productModel: string | null;
  purchaseDevices: number;
  inStock: number;
  salesDevices: number;
}

export interface StockReportTotals {
  purchaseDevices: number;
  inStock: number;
  salesDevices: number;
}

export interface StockReportFilters {
  storeId: string | null;
  categoryId: number | null;
}

export interface StockReportResponse {
  period: ReportPeriod;
  filters: StockReportFilters;
  totals: StockReportTotals;
  products: StockReportProduct[];
}

export type StockReportQuery = ReportQuery;
