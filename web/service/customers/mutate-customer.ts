import { apiFetch } from "@/service/client";
import type {
  CreateCustomerInput,
  Customer,
  UpdateCustomerInput,
} from "@/types/customers/customer";

export function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  return apiFetch<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  return apiFetch<Customer>(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
