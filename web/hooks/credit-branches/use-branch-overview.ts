"use client";

import { useQuery } from "@tanstack/react-query";

import { listAuditLogs } from "@/service/audit-logs/list-audit-logs";
import { listBranchPayments } from "@/service/branch-payments/branch-payments";
import { getReceivables } from "@/service/customers/billing";
import { listCustomers } from "@/service/customers/list-customers";
import { listExpenses } from "@/service/expenses/list-expenses";
import { listInventory } from "@/service/inventory/list-inventory";
import { getAdminDashboard } from "@/service/reports/admin-dashboard";
import { listSales } from "@/service/sales/list-sales";
import { listUsers } from "@/service/users/list-users";
import { toNumber } from "@/lib/reports/format";
import { useAppStore } from "@/store/app";
import type { ReportQuery } from "@/types/reports/query";

/**
 * Everything on a credit branch's page reads through an explicit branch id,
 * never the dashboard's branch selector. All keys sit under
 * ["credit-branches", id, ...] so crediting stock, a return or a payment
 * refreshes the whole page.
 */
const key = (id: string, ...rest: unknown[]) =>
  ["credit-branches", id, ...rest] as const;

/** Whether this user may read a page's data (an admin may read all of them). */
export function usePageAccess() {
  const user = useAppStore((s) => s.user);
  return (...pages: string[]): boolean => {
    if (user?.role !== "limited") return true;
    return pages.some((page) => user.allowedPages.includes(page));
  };
}

/** The branch's own sales, costs, expenses and stock for a period (branch cost basis). */
export function useBranchDashboard(
  id: string,
  range: ReportQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: key(id, "dashboard", range.fromDate, range.toDate),
    queryFn: () => getAdminDashboard({ ...range, storeId: id }),
    enabled,
  });
}

/** What the branch's own customers still owe it, all time. */
export function useBranchReceivables(id: string, enabled = true) {
  return useQuery({
    queryKey: key(id, "receivables"),
    queryFn: () => getReceivables(id),
    enabled,
  });
}

/** Sales from the branch waiting for the admin's review. */
export function useBranchPendingSales(id: string, enabled = true) {
  return useQuery({
    queryKey: key(id, "pending-sales"),
    queryFn: () => listSales({ storeId: id, status: "pending", limit: 50 }),
    enabled,
    select: (res) => ({
      count: res.meta.total,
      amount: res.data.reduce((sum, s) => sum + toNumber(s.totalAmount), 0),
    }),
  });
}

/** Payments from the branch waiting for the admin's review. */
export function useBranchPendingPayments(id: string, enabled = true) {
  return useQuery({
    queryKey: key(id, "pending-payments"),
    queryFn: () =>
      listBranchPayments({ storeId: id, status: "pending", limit: 50 }),
    enabled,
    select: (res) => ({
      count: res.meta.total,
      amount: res.data.reduce((sum, p) => sum + toNumber(p.amount), 0),
    }),
  });
}

/** The latest approved payment, for "last payment 3 days ago". */
export function useBranchLastPayment(id: string, enabled = true) {
  return useQuery({
    queryKey: key(id, "last-payment"),
    queryFn: () =>
      listBranchPayments({
        storeId: id,
        status: "approved",
        sortBy: "paidAt",
        order: "desc",
        limit: 1,
      }),
    enabled,
    select: (res) => res.data[0] ?? null,
  });
}

/** The branch's manager (the first active one). */
export function useBranchManager(id: string, enabled = true) {
  return useQuery({
    queryKey: key(id, "manager"),
    queryFn: () =>
      listUsers({ storeId: id, role: "branch_manager", limit: 5 }),
    enabled,
    select: (res) =>
      res.data.find((u) => u.isActive) ?? res.data[0] ?? null,
  });
}

/** One page of a tab's list. */
export function useBranchTabList<T>(
  id: string,
  tab: "stock" | "sales" | "payments" | "customers" | "expenses" | "people" | "activity",
  page: number,
  limit: number,
) {
  return useQuery({
    queryKey: key(id, "tab", tab, page, limit),
    queryFn: async (): Promise<{ data: T[]; total: number }> => {
      const res = await (() => {
        switch (tab) {
          case "stock":
            return listInventory({ storeId: id, page, limit });
          case "sales":
            return listSales({ storeId: id, page, limit });
          case "payments":
            return listBranchPayments({
              storeId: id,
              page,
              limit,
              sortBy: "paidAt",
              order: "desc",
            });
          case "customers":
            return listCustomers({ storeId: id, page, limit });
          case "expenses":
            return listExpenses({ storeId: id, page, limit });
          case "people":
            return listUsers({ storeId: id, page, limit });
          case "activity":
            return listAuditLogs({ storeId: id, page, limit });
        }
      })();
      return { data: res.data as unknown as T[], total: res.meta.total };
    },
    placeholderData: (previous) => previous,
  });
}
