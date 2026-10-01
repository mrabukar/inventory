import { apiFetch } from "@/service/client";

export interface CompanyNetProfit {
  netProfit: number;
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
}

export function getCompanyNetProfit(): Promise<CompanyNetProfit> {
  return apiFetch<CompanyNetProfit>("/api/reports/company-net-profit");
}
