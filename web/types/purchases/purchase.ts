import type { PaginatedResponse } from "@/types/common/pagination";
import type { Product, ProductCategory } from "@/types/products/product";
import { toNumber } from "@/lib/reports/format";

export interface PurchaseUser {
  id: string;
  name: string;
  email: string;
}

export type PurchaseType = "purchase" | "correction";

export interface Purchase {
  id: string;
  productId: string;
  quantity: number;
  unitPurchasePrice: number | string;
  totalCost: number | string;
  type: PurchaseType;
  correctsPurchaseId: string | null;
  invoiceNumber: string | null;
  purchaseDate: string;
  note: string | null;
  purchasedById: string;
  createdAt: string;
  product: Product & { category: ProductCategory };
  purchasedBy: PurchaseUser;
  /** Units still available to remove on this purchase row after prior corrections. */
  reversibleQuantity?: number;
}

export interface PurchaseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
  invoiceNumber?: string;
  categoryId?: string;
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

export interface CorrectPurchaseInput {
  quantity: number;
  reason: string;
}

export function purchaseTotal(purchase: Purchase): number {
  return toNumber(purchase.totalCost);
}

// ── Batch creation ────────────────────────────────────────────────────────────

export interface CreatePurchaseBatchItemInput {
  productId: string;
  quantity: number;
  unitPurchasePrice: number;
  newSellingPrice?: number;
  acceptSellingBelowCost?: boolean;
}

export interface CreatePurchaseBatchInput {
  purchaseDate: string;
  invoiceNumber?: string;
  note?: string;
  items: CreatePurchaseBatchItemInput[];
}

export type CreatePurchaseBatchResponse = (Purchase & { product: Purchase["product"] })[];
