import type { PaginatedResponse } from "@/types/common/pagination";

export interface Store {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreListQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export type StoreListResponse = PaginatedResponse<Store>;
