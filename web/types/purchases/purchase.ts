import type { PaginatedResponse } from "@/types/common/pagination";
import type { Product, ProductCategory } from "@/types/products/product";
import { toNumber } from "@/lib/reports/format";

export interface PurchaseUser {
  id: string;
  name: string;
  email: string;
}

export interface Purchase {
  id: string;
  productId: string;
  quantity: number;
  unitPurchasePrice: number | string;
  totalCost: number | string;
  invoiceNumber: string | null;
  purchaseDate: string;
  note: string | null;
  purchasedById: string;
  createdAt: string;
  product: Product & { category: ProductCategory };
  purchasedBy: PurchaseUser;
}

export interface PurchaseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
  invoiceNumber?: string;
  categoryId?: number;
  fromDate?: string;
  toDate?: string;
}

export type PurchaseListResponse = PaginatedResponse<Purchase>;

export interface CreatePurchaseInput {
  productId: string;
  quantity: number;
  unitPurchasePrice: number;
  purchaseDate: string;
  invoiceNumber?: string;
  note?: string;
  newSellingPrice?: number;
  acceptSellingBelowCost?: boolean;
}

export function purchaseTotal(purchase: Purchase): number {
  return toNumber(purchase.totalCost);
}
