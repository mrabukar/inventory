import { apiFetch } from "@/service/client";
import type {
  CreatePurchaseInput,
  Purchase,
} from "@/types/purchases/purchase";
import type { Product } from "@/types/products/product";

export type CreatePurchaseResponse = Purchase & {
  product: Product;
};

export function createPurchase(
  input: CreatePurchaseInput,
): Promise<CreatePurchaseResponse> {
  return apiFetch<CreatePurchaseResponse>("/api/purchases", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
