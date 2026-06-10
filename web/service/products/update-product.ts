import { apiFetch } from "@/service/client";
import type { Product } from "@/types/products/product";
import type { UpdateProductInput } from "@/types/products/update-product";

export function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<Product> {
  return apiFetch<Product>(`/api/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
