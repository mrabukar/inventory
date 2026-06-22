import { apiFetch } from "@/service/client";
import type {
  CorrectPurchaseInput,
  Purchase,
} from "@/types/purchases/purchase";
import type { Product } from "@/types/products/product";

export type CorrectPurchaseResponse = Purchase & {
  product: Product;
};

export function correctPurchase(
  purchaseId: string,
  input: CorrectPurchaseInput,
): Promise<CorrectPurchaseResponse> {
  return apiFetch<CorrectPurchaseResponse>(
    `/api/purchases/${purchaseId}/correct`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
