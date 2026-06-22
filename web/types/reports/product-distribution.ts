import type { ReportPeriod } from "./common";
import type { ReportQuery } from "./query";

export interface ProductDistributionProduct {
  productId: string;
  productName: string;
  productModel: string | null;
  unitsSold: number;
  percent: number;
}

export interface ProductDistributionTrendSeries {
  productId: string;
  productName: string;
  productModel: string | null;
  values: number[];
}

export interface ProductDistributionTrend {
  dates: string[];
  series: ProductDistributionTrendSeries[];
}

export interface ProductDistributionFilters {
  categoryId: string;
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
  categoryId: string;
}
