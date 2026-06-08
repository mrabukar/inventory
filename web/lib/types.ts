export type Role = "admin" | "manager";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role | "branch_manager";
  store: string | null;
  active: boolean;
  created: string;
  by: string;
}

export interface Product {
  id: string;
  name: string;
  cat: string;
  purchase: number;
  sell: number;
  active: boolean;
  by: string;
  desc?: string;
}

export interface InventoryRow {
  id: string;
  product: string;
  cat: string;
  store: string;
  qty: number;
  threshold: number;
  purchase: number;
  updated: string;
}

export interface Sale {
  id: string;
  date: string;
  store: string;
  product: string;
  cat: string;
  manager: string;
  qty: number;
  unit: number;
  profit: number;
  status: "active" | "corrected";
}

export interface Expense {
  id: string;
  date: string;
  title: string;
  cat: string;
  store: string | null;
  amount: number;
  by: string;
}

export interface SupplyRow {
  id: string;
  date: string;
  product: string;
  cat: string;
  store: string;
  qty: number;
  unit: number;
  by: string;
  note: string;
}

export interface AuditRow {
  id: string;
  ts: string;
  user: string;
  role: string;
  action: string;
  entity: string;
  store: string;
  source: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

export interface Summary {
  total_revenue: number;
  gross_profit: number;
  net_profit: number;
  total_expenses: number;
  current_stock_value: number;
  in_stock_balance: number;
  low_stock_count: number;
  units_sold: number;
  cogs: number;
}

export interface FeedItem {
  icon: string;
  color: string;
  text: string;
  time: string;
}

export interface Toast {
  id: number;
  kind?: "success" | "error";
  title: string;
  sub?: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  storeId: string | null;
  store: string | null;
}
