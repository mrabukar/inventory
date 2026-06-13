import { apiFetch } from "@/service/client";
import type { ManagerDashboardResponse } from "@/types/reports/manager-dashboard";

export function getManagerDashboard(): Promise<ManagerDashboardResponse> {
  return apiFetch<ManagerDashboardResponse>("/api/reports/manager-dashboard");
}
