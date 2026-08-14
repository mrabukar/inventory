import type { PaginatedResponse } from "@/types/common/pagination";
import type { Product, ProductCategory } from "@/types/products/product";
import type { Store } from "@/types/stores/store";
import type { Customer } from "@/types/customers/customer";
import type { SaleLocation } from "@/types/sales/sale-location";
import { toNumber } from "@/lib/reports/format";

export type SaleStatus = "active" | "corrected";

export interface SaleInvoiceSummary {
  id: string;
  numberLabel: string;
  status: "unpaid" | "partial" | "paid";
  total: number | string;
  paidAtSale: number | string;
  paidAmount: number | string;
}

export interface SaleSoldBy {
  id: string;
  name: string;
  email: string;
}

export interface SaleCorrection {
  id: string;
  saleId: string;
  saleItemId: string;
  originalQuantity: number;
  correctedQuantity: number;
  reason: string;
  correctedById: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  storeId: string;
  saleDate: string;
  quantitySold: number;
  unitPrice: number | string;
  /** Cost is stripped from branch-manager responses. */
  unitPurchasePrice?: number | string;
  lineTotal: number | string;
  product: Product & { category: ProductCategory };
}

export interface Sale {
  id: string;
  storeId: string;
  soldById: string;
  customerId: string | null;
  totalAmount: number | string;
  saleDate: string;
  note: string | null;
  status: SaleStatus;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
  store: Store;
  customer: Customer | null;
  location?: SaleLocation | null;
  invoice?: SaleInvoiceSummary | null;
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

/** Total units across all line items. */
export function saleUnitsSold(sale: Sale): number {
  return sale.items.reduce((sum, item) => sum + item.quantitySold, 0);
}

/** Distinct product summary for compact display, e.g. "iPhone 15 +2 more". */
export function saleProductSummary(sale: Sale): string {
  if (sale.items.length === 0) return "—";
  const [first, ...rest] = sale.items;
  const firstLabel = first.product.name;
  return rest.length > 0 ? `${firstLabel} +${rest.length} more` : firstLabel;
}

export function saleProfit(sale: Sale): number {
  return sale.items.reduce((sum, item) => {
    const cost =
      item.unitPurchasePrice != null ? toNumber(item.unitPurchasePrice) : 0;
    return sum + (toNumber(item.lineTotal) - cost * item.quantitySold);
  }, 0);
}
