import type { PaginatedResponse } from "@/types/common/pagination";
import type { Product, ProductCategory } from "@/types/products/product";
import type { Store } from "@/types/stores/store";
import { toNumber } from "@/lib/reports/format";

export type SaleStatus = "active" | "corrected";

export interface SaleSoldBy {
  id: string;
  name: string;
  email: string;
}

export interface SaleCorrection {
  id: string;
  saleId: string;
  originalQuantity: number;
  correctedQuantity: number;
  reason: string;
  correctedById: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  productId: string;
  storeId: string;
  soldById: string;
  quantitySold: number;
  unitPrice: number | string;
  unitPurchasePrice: number | string;
  totalAmount: number | string;
  saleDate: string;
  note: string | null;
  status: SaleStatus;
  createdAt: string;
  updatedAt: string;
  product: Product & { category: ProductCategory };
  store: Store;
  soldBy: SaleSoldBy;
  corrections: SaleCorrection[];
}

export interface SaleListQuery {
  page?: number;
  limit?: number;
  search?: string;
  storeId?: string;
  categoryId?: string;
  status?: SaleStatus;
  fromDate?: string;
  toDate?: string;
}

export type SaleListResponse = PaginatedResponse<Sale>;

export function saleProfit(sale: Sale): number {
  return (
    toNumber(sale.totalAmount) -
    toNumber(sale.unitPurchasePrice) * sale.quantitySold
  );
}
