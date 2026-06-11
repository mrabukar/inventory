"use client";

import { useQuery } from "@tanstack/react-query";
import { getLastSixMonthsRange } from "@/lib/filters/dates";
import { getFinancialSummary } from "@/service/reports/financial-summary";
import type { FinancialSummaryQuery } from "@/types/reports/financial-summary";

const defaultQuery = (): FinancialSummaryQuery => getLastSixMonthsRange();

export const financialSummaryQueryKey = (
  params: FinancialSummaryQuery = defaultQuery(),
) => ["reports", "financial-summary", params] as const;

export function useFinancialSummary(
  params: FinancialSummaryQuery = defaultQuery(),
) {
  return useQuery({
    queryKey: financialSummaryQueryKey(params),
    queryFn: () => getFinancialSummary(params),
  });
}
