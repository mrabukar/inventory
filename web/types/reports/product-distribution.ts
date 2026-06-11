import type { ReportPeriod } from "./common";
import type { ReportQuery } from "./query";

export interface ProductDistributionProduct {
  productId: string;
  productName: string;
  unitsSold: number;
  percent: number;
}

export interface ProductDistributionTrendSeries {
  productId: string;
  productName: string;
  values: number[];
}

export interface ProductDistributionTrend {
  dates: string[];
  series: ProductDistributionTrendSeries[];
}

export interface ProductDistributionFilters {
  categoryId: number;
  categoryName: string;
  storeId: string | null;
}

export interface ProductDistributionResponse {
  period: ReportPeriod;
  filters: ProductDistributionFilters;
  totalUnitsSold: number;
  products: ProductDistributionProduct[];
  trend: ProductDistributionTrend;
}

export interface ProductDistributionQuery extends ReportQuery {
  categoryId: number;
}
