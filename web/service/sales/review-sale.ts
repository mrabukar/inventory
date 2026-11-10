import { apiFetch } from "@/service/client";
import type { Sale } from "@/types/sales/sale";

export function approveSale(id: string): Promise<Sale> {
  return apiFetch<Sale>(`/api/sales/${id}/approve`, { method: "PATCH" });
}

export function rejectSale(id: string, reason: string): Promise<Sale> {
  return apiFetch<Sale>(`/api/sales/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function getPendingSalesCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/api/sales/pending-count");
}
