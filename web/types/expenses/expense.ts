import type { PaginatedResponse } from "@/types/common/pagination";
import type { Store } from "@/types/stores/store";
import { toNumber } from "@/lib/reports/format";
import type { ExpenseCategory } from "./expense-category";

export interface ExpenseUser {
  id: string;
  name: string;
  email: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number | string;
  categoryId: number;
  category: ExpenseCategory;
  storeId: string | null;
  store: Pick<Store, "id" | "name"> | null;
  expenseDate: string;
  note: string | null;
  createdById: string;
  createdBy: ExpenseUser;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  storeId?: string;
  companyWideOnly?: boolean;
  fromDate?: string;
  toDate?: string;
}

export type ExpenseListResponse = PaginatedResponse<Expense>;

export interface CreateExpenseInput {
  title: string;
  amount: number;
  categoryId: number;
  storeId?: string;
  expenseDate: string;
  note?: string;
}

export interface UpdateExpenseInput {
  title?: string;
  amount?: number;
  categoryId?: number;
  storeId?: string | null;
  expenseDate?: string;
  note?: string;
}

export function expenseAmount(expense: Pick<Expense, "amount">): number {
  return toNumber(expense.amount);
}

export function formatExpenseDate(expenseDate: string): string {
  return expenseDate.slice(0, 10);
}

const CATEGORY_COLORS: Record<string, string> = {
  Rent: "indigo",
  Salaries: "teal",
  Utilities: "violet",
  "Internet & Phone": "amber",
  Maintenance: "emerald",
  Transport: "rose",
  Other: "slate",
};

export function expenseCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? "slate";
}
