import { apiFetch } from "@/service/client";
import type {
  CreateStockCorrectionInput,
  StockSupply,
} from "@/types/stock-supplies/stock-supply";

export function createStockCorrectionAdd(
  input: CreateStockCorrectionInput,
): Promise<StockSupply> {
  return apiFetch<StockSupply>("/api/stock-supplies/corrections/add", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createStockCorrectionSubtract(
  input: CreateStockCorrectionInput,
): Promise<StockSupply> {
  return apiFetch<StockSupply>("/api/stock-supplies/corrections/subtract", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
