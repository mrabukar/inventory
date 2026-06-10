import { apiFetch } from "@/service/client";
import type { DeactivateProductInput } from "@/types/products/deactivate-product";

export function deactivateProduct(
  id: string,
  input: DeactivateProductInput = {},
): Promise<void> {
  return apiFetch<void>(`/api/products/${id}/deactivate`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
