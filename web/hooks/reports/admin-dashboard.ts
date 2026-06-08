"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentMonthRange } from "@/lib/filters/dates";
import { getAdminDashboard } from "@/service/reports/admin-dashboard";
import type { AdminDashboardQuery } from "@/types/reports/admin-dashboard";

const defaultQuery = (): AdminDashboardQuery => getCurrentMonthRange();

export const adminDashboardQueryKey = (params: AdminDashboardQuery = defaultQuery()) =>
  ["reports", "admin-dashboard", params] as const;

export function useAdminDashboard(params: AdminDashboardQuery = defaultQuery()) {
  return useQuery({
    queryKey: adminDashboardQueryKey(params),
    queryFn: () => getAdminDashboard(params),
  });
}
