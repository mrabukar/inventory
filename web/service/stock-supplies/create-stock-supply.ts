import { apiFetch } from "@/service/client";
import type {
  CreateStockSupplyInput,
  StockSupply,
} from "@/types/stock-supplies/stock-supply";

export function createStockSupply(
  input: CreateStockSupplyInput,
): Promise<StockSupply> {
  return apiFetch<StockSupply>("/api/stock-supplies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
