import { apiFetch } from "@/service/client";
import { getLastSixMonthsRange } from "@/lib/filters/dates";
import type {
  FinancialSummaryQuery,
  FinancialSummaryResponse,
} from "@/types/reports/financial-summary";

function toQueryString(params: FinancialSummaryQuery): string {
  const search = new URLSearchParams();

  search.set("fromDate", params.fromDate);
  search.set("toDate", params.toDate);
  if (params.storeId) search.set("storeId", params.storeId);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function getFinancialSummary(
  params: FinancialSummaryQuery = getLastSixMonthsRange(),
): Promise<FinancialSummaryResponse> {
  return apiFetch<FinancialSummaryResponse>(
    `/api/reports/financial-summary${toQueryString(params)}`,
  );
}
