import { apiFetch } from "@/service/client";
import type {
  ProductDistributionQuery,
  ProductDistributionResponse,
} from "@/types/reports/product-distribution";

function toQueryString(params: ProductDistributionQuery): string {
  const search = new URLSearchParams();

  search.set("fromDate", params.fromDate);
  search.set("toDate", params.toDate);
  search.set("categoryId", String(params.categoryId));
  if (params.storeId) search.set("storeId", params.storeId);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function getProductDistribution(
  params: ProductDistributionQuery,
): Promise<ProductDistributionResponse> {
  return apiFetch<ProductDistributionResponse>(
    `/api/reports/product-distribution${toQueryString(params)}`,
  );
}
