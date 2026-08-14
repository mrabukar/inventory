import { apiFetch } from "@/service/client";
import type {
  CreateSaleLocationInput,
  SaleLocation,
} from "@/types/sales/sale-location";

export function listSaleLocations(
  includeInactive = false,
): Promise<SaleLocation[]> {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return apiFetch<SaleLocation[]>(`/api/sale-locations${qs}`);
}

export function createSaleLocation(
  input: CreateSaleLocationInput,
): Promise<SaleLocation> {
  return apiFetch<SaleLocation>("/api/sale-locations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
