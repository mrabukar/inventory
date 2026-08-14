"use client";

import { useQuery } from "@tanstack/react-query";
import { getCustomer, listCustomers } from "@/service/customers/list-customers";
import type { CustomerListQuery } from "@/types/customers/customer";

export function useCustomers(params: CustomerListQuery = {}) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => listCustomers(params),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id!),
    enabled: Boolean(id),
  });
}
