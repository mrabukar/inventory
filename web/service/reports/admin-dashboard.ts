import { apiFetch } from "@/service/client";
import { getCurrentMonthRange } from "@/lib/filters/dates";
import type {
  AdminDashboardQuery,
  AdminDashboardResponse,
} from "@/types/reports/admin-dashboard";

function toQueryString(params: AdminDashboardQuery): string {
  const search = new URLSearchParams();

  search.set("fromDate", params.fromDate);
  search.set("toDate", params.toDate);
  if (params.storeId) search.set("storeId", params.storeId);
  if (params.categoryId != null)
    search.set("categoryId", String(params.categoryId));

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function getAdminDashboard(
  params: AdminDashboardQuery = getCurrentMonthRange(),
): Promise<AdminDashboardResponse> {
  return apiFetch<AdminDashboardResponse>(
    `/api/reports/admin-dashboard${toQueryString(params)}`,
  );
}
