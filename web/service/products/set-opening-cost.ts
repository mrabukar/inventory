import { apiFetch } from "@/service/client";
import type { CreatePurchaseResponse } from "@/service/purchases/create-purchase";

export interface SetOpeningCostInput {
  unitPurchasePrice: number;
  purchaseDate: string;
  note?: string;
  newSellingPrice?: number;
  acceptSellingBelowCost?: boolean;
}

export function setOpeningCost(
  productId: string,
  input: SetOpeningCostInput,
): Promise<CreatePurchaseResponse> {
  return apiFetch<CreatePurchaseResponse>(
    `/api/products/${productId}/opening-cost`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
