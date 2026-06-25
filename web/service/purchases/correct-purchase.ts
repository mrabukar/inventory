import { apiFetch } from "@/service/client";
import type {
  CorrectPurchaseInput,
  Purchase,
} from "@/types/purchases/purchase";
import type { Product } from "@/types/products/product";

export type CorrectPurchaseResponse = Purchase & {
  product: Product;
};

export function correctPurchaseSubtract(
  purchaseId: string,
  input: CorrectPurchaseInput,
): Promise<CorrectPurchaseResponse> {
  return apiFetch<CorrectPurchaseResponse>(
    `/api/purchases/${purchaseId}/correct/subtract`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function correctPurchaseAdd(
  purchaseId: string,
  input: CorrectPurchaseInput,
): Promise<CorrectPurchaseResponse> {
  return apiFetch<CorrectPurchaseResponse>(
    `/api/purchases/${purchaseId}/correct/add`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

/** @deprecated Use correctPurchaseSubtract */
export function correctPurchase(
  purchaseId: string,
  input: CorrectPurchaseInput,
): Promise<CorrectPurchaseResponse> {
  return correctPurchaseSubtract(purchaseId, input);
}
