"use client";

import { useQuery } from "@tanstack/react-query";
import { getManagerDashboard } from "@/service/reports/manager-dashboard";

export const managerDashboardQueryKey = () =>
  ["reports", "manager-dashboard"] as const;

export function useManagerDashboard() {
  return useQuery({
    queryKey: managerDashboardQueryKey(),
    queryFn: () => getManagerDashboard(),
  });
}
