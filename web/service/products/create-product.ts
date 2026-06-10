import { apiFetch } from "@/service/client";
import type { CreateProductInput } from "@/types/products/create-product";
import type { Product } from "@/types/products/product";

export function createProduct(input: CreateProductInput): Promise<Product> {
  return apiFetch<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
