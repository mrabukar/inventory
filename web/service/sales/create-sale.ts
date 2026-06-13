import { apiFetch } from "@/service/client";
import type { CreateSaleInput } from "@/types/sales/create-sale";
import type { Sale } from "@/types/sales/sale";

export function createSale(input: CreateSaleInput): Promise<Sale> {
  return apiFetch<Sale>("/api/sales", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
