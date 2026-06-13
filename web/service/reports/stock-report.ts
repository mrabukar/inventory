import { apiFetch } from "@/service/client";
import type {
  StockReportQuery,
  StockReportResponse,
} from "@/types/reports/stock-report";

function toQueryString(params: StockReportQuery): string {
  const search = new URLSearchParams();

  search.set("fromDate", params.fromDate);
  search.set("toDate", params.toDate);
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.categoryId != null) {
    search.set("categoryId", String(params.categoryId));
  }

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function getStockReport(
  params: StockReportQuery,
): Promise<StockReportResponse> {
  return apiFetch<StockReportResponse>(
    `/api/reports/stock-report${toQueryString(params)}`,
  );
}
