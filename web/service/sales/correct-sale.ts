import { apiFetch } from "@/service/client";
import type { CorrectSaleInput } from "@/types/sales/create-sale";
import type { Sale } from "@/types/sales/sale";

export function correctSale(
  id: string,
  input: CorrectSaleInput,
): Promise<Sale> {
  return apiFetch<Sale>(`/api/sales/${id}/correct`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
