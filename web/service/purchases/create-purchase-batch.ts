import { apiFetch } from "@/service/client";
import type {
  CreatePurchaseBatchInput,
  CreatePurchaseBatchResponse,
} from "@/types/purchases/purchase";

export function createPurchaseBatch(
  input: CreatePurchaseBatchInput,
): Promise<CreatePurchaseBatchResponse> {
  return apiFetch<CreatePurchaseBatchResponse>("/api/purchases/batch", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
