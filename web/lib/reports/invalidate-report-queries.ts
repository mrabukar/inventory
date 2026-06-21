import type { QueryClient } from "@tanstack/react-query";

/** Refresh dashboard, financial summary, and stock report after inventory/cost changes. */
export function invalidateReportQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["reports", "admin-dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["reports", "financial-summary"] });
  queryClient.invalidateQueries({ queryKey: ["reports", "stock-report"] });
}
