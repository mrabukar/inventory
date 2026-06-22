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
  categoryId: string;
  category: ProductCategory;
  description: string | null;
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
  categoryId?: string;
}

export type ProductListResponse = PaginatedResponse<Product>;
