import { apiFetch } from "@/service/client";
import type {
  CustomerBalance,
  CustomerStatement,
  ReceivableRow,
} from "@/types/payments/payment";

export function getCustomerBalance(
  customerId: string,
): Promise<CustomerBalance> {
  return apiFetch<CustomerBalance>(`/api/customers/${customerId}/balance`);
}

export function getCustomerStatement(
  customerId: string,
): Promise<CustomerStatement> {
  return apiFetch<CustomerStatement>(`/api/customers/${customerId}/statement`);
}

export function getReceivables(storeId?: string): Promise<ReceivableRow[]> {
  const qs = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  return apiFetch<ReceivableRow[]>(`/api/customers/receivables${qs}`);
}
