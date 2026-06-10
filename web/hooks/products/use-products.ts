"use client";

import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/service/products/list-products";
import type { ProductListQuery } from "@/types/products/product";

export const productsQueryKey = (params: ProductListQuery = {}) =>
  ["products", params] as const;

export function useProducts(params: ProductListQuery = {}) {
  return useQuery({
    queryKey: productsQueryKey(params),
    queryFn: () => listProducts(params),
  });
}
