import type { PaginatedResponse } from "@/types/common/pagination";
import type { Product, ProductCategory } from "@/types/products/product";
import type { Store } from "@/types/stores/store";
import { toNumber } from "@/lib/reports/format";
import { formatProductLabel } from "@/lib/products/format";

export type StockSupplyType =
  | "supply"
  | "correction_add"
  | "correction_subtract";

export interface StockSupplyUser {
  id: string;
  name: string;
  email: string;
}

export interface StockSupplyReference {
  id: string;
  type: StockSupplyType;
  quantity: number;
  createdAt: string;
}

export interface StockSupply {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
  unitPurchasePrice: number | string;
  type: StockSupplyType;
  correctsSupplyId: string | null;
  suppliedById: string;
  note: string | null;
  createdAt: string;
  product: Product & { category: ProductCategory };
  store: Store;
  suppliedBy: StockSupplyUser;
  correctsSupply: StockSupplyReference | null;
}

export interface StockSupplyListQuery {
  page?: number;
  limit?: number;
  search?: string;
  storeId?: string;
  productId?: string;
  categoryId?: string;
  type?: StockSupplyType;
  fromDate?: string;
  toDate?: string;
}

export type StockSupplyListResponse = PaginatedResponse<StockSupply>;

export interface CreateStockSupplyInput {
  productId: string;
  storeId?: string;
  quantity: number;
  unitPurchasePrice?: number;
  note?: string;
}

export interface CreateStockCorrectionInput {
  productId: string;
  storeId?: string;
  quantity: number;
  unitPurchasePrice?: number;
  note: string;
  correctsSupplyId?: string;
}

export function supplyInvestment(supply: StockSupply): number {
  return Math.abs(supply.quantity) * toNumber(supply.unitPurchasePrice);
}

export function isSupplyCorrection(supply: StockSupply): boolean {
  return supply.type !== "supply";
}

export function supplyTypeLabel(type: StockSupplyType): string {
  if (type === "supply") return "Supply";
  if (type === "correction_add") return "Fix (added units)";
  return "Fix (removed units)";
}

export function formatSupplyPickerLabel(supply: StockSupply): string {
  const qty =
    supply.quantity > 0 ? `+${supply.quantity}` : String(supply.quantity);
  const date = supply.createdAt.slice(0, 10);
  return `${date} · ${formatProductLabel(supply.product.name, supply.product.model)} · ${supply.store.name} · ${qty} units`;
}
