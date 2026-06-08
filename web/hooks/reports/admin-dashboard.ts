"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminDashboard } from "@/service/reports/admin-dashboard";
import type { AdminDashboardQuery } from "@/types/reports/admin-dashboard";

export const adminDashboardQueryKey = (params: AdminDashboardQuery = {}) =>
  ["reports", "admin-dashboard", params] as const;

export function useAdminDashboard(params: AdminDashboardQuery = {}) {
  return useQuery({
    queryKey: adminDashboardQueryKey(params),
    queryFn: () => getAdminDashboard(params),
  });
}
