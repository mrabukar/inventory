import type { PaginatedResponse } from "@/types/common/pagination";
import type { ProductCategory } from "@/types/products/product";
import type { Store } from "@/types/stores/store";

export interface InventoryProduct {
  id: string;
  name: string;
  normalizedName: string;
  categoryId: number;
  description: string | null;
  purchasePrice: number | string;
  sellingPrice: number | string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  category: ProductCategory;
}

export interface Inventory {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
  product: InventoryProduct;
  store: Store;
}

export type InventoryListScope = "all" | "low-stock" | "out-of-stock";

export interface InventoryListQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  storeId?: string;
}

export type InventoryListResponse = PaginatedResponse<Inventory>;
