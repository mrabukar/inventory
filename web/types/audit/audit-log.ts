import type { PaginatedResponse } from "@/types/common/pagination";

export type AuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DEACTIVATED"
  | "PRODUCT_REACTIVATED"
  | "STOCK_SUPPLIED"
  | "SALE_CREATED"
  | "SALE_CORRECTED"
  | "INVENTORY_UPDATED"
  | "EXPENSE_CREATED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_DELETED"
  | "STORE_CREATED"
  | "STORE_UPDATED"
  | "STORE_DEACTIVATED"
  | "STORE_REACTIVATED"
  | "REPORT_EXPORTED";

export type AuditJsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface AuditLogUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "branch_manager";
}

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValue: AuditJsonValue;
  newValue: AuditJsonValue;
  createdAt: string;
  user: AuditLogUser;
}

export interface AuditLogListQuery {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
}

export type AuditLogListResponse = PaginatedResponse<AuditLog>;

export interface AuditDiffLine {
  kind: " " | "+" | "-";
  text: string;
}

const ENTITY_LABELS: Record<string, string> = {
  stock_supply: "supply",
  sale: "sale",
  product: "product",
  expense: "expense",
  inventory: "inventory",
  store: "store",
  user: "user",
  report: "report",
};

const ACTION_COLORS: Record<AuditAction, string> = {
  USER_CREATED: "violet",
  USER_UPDATED: "violet",
  USER_DEACTIVATED: "violet",
  USER_REACTIVATED: "violet",
  PRODUCT_CREATED: "slate",
  PRODUCT_UPDATED: "slate",
  PRODUCT_DEACTIVATED: "slate",
  PRODUCT_REACTIVATED: "slate",
  STOCK_SUPPLIED: "indigo",
  SALE_CREATED: "teal",
  SALE_CORRECTED: "rose",
  INVENTORY_UPDATED: "slate",
  EXPENSE_CREATED: "amber",
  EXPENSE_UPDATED: "amber",
  EXPENSE_DELETED: "amber",
  STORE_CREATED: "indigo",
  STORE_UPDATED: "indigo",
  STORE_DEACTIVATED: "indigo",
  STORE_REACTIVATED: "indigo",
  REPORT_EXPORTED: "teal",
};

const ACTION_LABELS: Record<AuditAction, string> = {
  USER_CREATED: "User created",
  USER_UPDATED: "User updated",
  USER_DEACTIVATED: "User deactivated",
  USER_REACTIVATED: "User reactivated",
  PRODUCT_CREATED: "Product created",
  PRODUCT_UPDATED: "Product updated",
  PRODUCT_DEACTIVATED: "Product deactivated",
  PRODUCT_REACTIVATED: "Product reactivated",
  STOCK_SUPPLIED: "Stock supplied",
  SALE_CREATED: "Sale created",
  SALE_CORRECTED: "Sale corrected",
  INVENTORY_UPDATED: "Inventory updated",
  EXPENSE_CREATED: "Expense created",
  EXPENSE_UPDATED: "Expense updated",
  EXPENSE_DELETED: "Expense deleted",
  STORE_CREATED: "Store created",
  STORE_UPDATED: "Store updated",
  STORE_DEACTIVATED: "Store deactivated",
  STORE_REACTIVATED: "Store reactivated",
  REPORT_EXPORTED: "Report exported",
};

export const AUDIT_ACTION_ITEMS = (Object.keys(ACTION_LABELS) as AuditAction[]).map(
  (action) => ({
    value: action,
    label: ACTION_LABELS[action],
  }),
);

export function auditActionColor(action: AuditAction): string {
  return ACTION_COLORS[action] ?? "slate";
}

export function auditActionLabel(action: AuditAction): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatAuditTimestamp(createdAt: string): string {
  const date = new Date(createdAt);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatAuditEntity(log: AuditLog): string {
  return ENTITY_LABELS[log.entityType] ?? log.entityType.replace(/_/g, " ");
}

function asRecord(value: AuditJsonValue): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function productNameFrom(record: Record<string, unknown> | null): string | undefined {
  if (!record) return undefined;
  return readString(record.name) ?? readString(record.productName);
}

export function formatAuditSummary(log: AuditLog): string {
  const oldRecord = asRecord(log.oldValue);
  const newRecord = asRecord(log.newValue);

  switch (log.action) {
    case "STOCK_SUPPLIED": {
      const qty = readNumber(newRecord?.quantity);
      const note = readString(newRecord?.note);
      if (qty != null) {
        const signed = qty > 0 ? `+${qty}` : String(qty);
        return note
          ? `Stock adjustment ${signed} units (${note})`
          : `Stock adjustment ${signed} units`;
      }
      return "Stock supplied";
    }
    case "SALE_CREATED": {
      const product = readString(newRecord?.productName) ?? "product";
      const qty = readNumber(newRecord?.quantitySold);
      return qty != null
        ? `Sold ${qty} × ${product}`
        : `Sale recorded for ${product}`;
    }
    case "SALE_CORRECTED": {
      const from = readNumber(oldRecord?.quantitySold);
      const to = readNumber(newRecord?.quantitySold);
      if (from != null && to != null) {
        return `Corrected sale quantity ${from} → ${to}`;
      }
      return "Sale quantity corrected";
    }
    case "PRODUCT_CREATED": {
      const name = productNameFrom(newRecord);
      return name ? `Created product ${name}` : "Product created";
    }
    case "PRODUCT_UPDATED": {
      const name = productNameFrom(newRecord) ?? productNameFrom(oldRecord);
      const changed: string[] = [];
      if (oldRecord && newRecord) {
        if (oldRecord.sellingPrice !== newRecord.sellingPrice) {
          changed.push("selling price");
        }
        if (oldRecord.purchasePrice !== newRecord.purchasePrice) {
          changed.push("purchase price");
        }
        if (oldRecord.name !== newRecord.name) changed.push("name");
        if (oldRecord.categoryId !== newRecord.categoryId) {
          changed.push("category");
        }
      }
      if (changed.length > 0) {
        const target = name ? ` on ${name}` : "";
        return `Updated ${changed.join(", ")}${target}`;
      }
      return name ? `Updated product ${name}` : "Product updated";
    }
    case "PRODUCT_DEACTIVATED": {
      const name = productNameFrom(oldRecord) ?? productNameFrom(newRecord);
      return name ? `Deactivated product ${name}` : "Product deactivated";
    }
    case "PRODUCT_REACTIVATED": {
      const name = productNameFrom(newRecord) ?? productNameFrom(oldRecord);
      return name ? `Reactivated product ${name}` : "Product reactivated";
    }
    case "EXPENSE_CREATED": {
      const title = readString(newRecord?.title) ?? "expense";
      const amount = readNumber(newRecord?.amount);
      const category = readString(newRecord?.categoryName);
      const amountPart = amount != null ? ` ($${amount})` : "";
      const categoryPart = category ? ` · ${category}` : "";
      return `Created expense ${title}${amountPart}${categoryPart}`;
    }
    case "EXPENSE_UPDATED": {
      const title =
        readString(newRecord?.title) ?? readString(oldRecord?.title) ?? "expense";
      return `Updated expense ${title}`;
    }
    case "EXPENSE_DELETED": {
      const title = readString(oldRecord?.title) ?? "expense";
      return `Deleted expense ${title}`;
    }
    case "INVENTORY_UPDATED": {
      const from = readNumber(oldRecord?.quantity);
      const to = readNumber(newRecord?.quantity);
      if (from != null && to != null) {
        return `Inventory quantity ${from} → ${to}`;
      }
      return "Inventory quantity updated";
    }
    case "USER_CREATED": {
      const name = readString(newRecord?.name) ?? readString(newRecord?.email);
      return name ? `Created user ${name}` : "User created";
    }
    case "USER_UPDATED": {
      const name = readString(newRecord?.name) ?? readString(oldRecord?.name);
      return name ? `Updated user ${name}` : "User updated";
    }
    case "USER_DEACTIVATED": {
      const name = readString(oldRecord?.name) ?? readString(newRecord?.name);
      return name ? `Deactivated user ${name}` : "User deactivated";
    }
    case "USER_REACTIVATED": {
      const name = readString(newRecord?.name) ?? readString(oldRecord?.name);
      return name ? `Reactivated user ${name}` : "User reactivated";
    }
    case "STORE_CREATED": {
      const name = readString(newRecord?.name);
      return name ? `Created store ${name}` : "Store created";
    }
    case "STORE_UPDATED": {
      const name = readString(newRecord?.name) ?? readString(oldRecord?.name);
      return name ? `Updated store ${name}` : "Store updated";
    }
    case "STORE_DEACTIVATED": {
      const name = readString(oldRecord?.name) ?? readString(newRecord?.name);
      return name ? `Deactivated store ${name}` : "Store deactivated";
    }
    case "STORE_REACTIVATED": {
      const name = readString(newRecord?.name) ?? readString(oldRecord?.name);
      return name ? `Reactivated store ${name}` : "Store reactivated";
    }
    case "REPORT_EXPORTED": {
      const report = readString(newRecord?.report) ?? log.entityId;
      const format = readString(newRecord?.format);
      const fromDate = readString(newRecord?.fromDate);
      const toDate = readString(newRecord?.toDate);
      const formatPart = format ? ` (${format.toUpperCase()})` : "";
      const periodPart =
        fromDate && toDate ? ` · ${fromDate} to ${toDate}` : "";
      return `Exported ${report?.replace(/-/g, " ") ?? "report"}${formatPart}${periodPart}`;
    }
    default:
      return `${log.action} on ${log.entityType}`;
  }
}

function diffVal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function buildAuditDiff(
  before: AuditJsonValue,
  after: AuditJsonValue,
): AuditDiffLine[] {
  const oldRecord = asRecord(before);
  const newRecord = asRecord(after);
  const out: AuditDiffLine[] = [];

  out.push({ kind: " ", text: "{" });

  if (!oldRecord && newRecord) {
    Object.entries(newRecord).forEach(([key, value], index, arr) => {
      const comma = index < arr.length - 1 ? "," : "";
      out.push({ kind: "+", text: `  "${key}": ${diffVal(value)}${comma}` });
    });
  } else if (oldRecord && !newRecord) {
    Object.entries(oldRecord).forEach(([key, value], index, arr) => {
      const comma = index < arr.length - 1 ? "," : "";
      out.push({ kind: "-", text: `  "${key}": ${diffVal(value)}${comma}` });
    });
  } else if (oldRecord && newRecord) {
    const keys = [...new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])];
    keys.forEach((key, index) => {
      const comma = index < keys.length - 1 ? "," : "";
      const inOld = key in oldRecord;
      const inNew = key in newRecord;

      if (inOld && inNew && oldRecord[key] === newRecord[key]) {
        out.push({ kind: " ", text: `  "${key}": ${diffVal(newRecord[key])}${comma}` });
      } else if (inOld && inNew) {
        out.push({ kind: "-", text: `  "${key}": ${diffVal(oldRecord[key])}${comma}` });
        out.push({ kind: "+", text: `  "${key}": ${diffVal(newRecord[key])}${comma}` });
      } else if (inNew) {
        out.push({ kind: "+", text: `  "${key}": ${diffVal(newRecord[key])}${comma}` });
      } else {
        out.push({ kind: "-", text: `  "${key}": ${diffVal(oldRecord[key])}${comma}` });
      }
    });
  }

  out.push({ kind: " ", text: "}" });
  return out;
}
