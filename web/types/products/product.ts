import type { PaginatedResponse } from "@/types/common/pagination";

export interface ProductCategory {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  normalizedName: string;
  model: string | null;
  categoryId: number;
  category: ProductCategory;
  description: string | null;
  purchasePrice: number | string;
  averageCost: number | string;
  sellingPrice: number | string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  missingOpeningCost?: boolean;
}

export type ProductListResponse = PaginatedResponse<Product>;
