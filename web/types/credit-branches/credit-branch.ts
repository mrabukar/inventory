import type { PaginationMeta } from "@/types/common/pagination";
import type { Product } from "@/types/products/product";

/** Contact and payment details printed on a credit branch's own invoices. */
export interface BranchDetails {
  phone: string | null;
  evcNumber: string | null;
  edahabNumber: string | null;
  accountNumber: string | null;
  /** The branch's invoice numbers read "PREFIX-0001". */
  invoicePrefix: string | null;
  /** The next invoice number to hand out; above 1 once an invoice has been issued. */
  nextInvoiceNumber?: number;
}

export interface CreditBranch extends BranchDetails {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  type: "credit";
  createdAt: string;
  updatedAt: string;
  totalCredited: number;
  totalReturned: number;
  totalPaid: number;
  totalPending: number;
  /** What the branch currently owes. */
  balance: number;
}

export interface CreateCreditBranchInput {
  name: string;
  address: string;
  phone?: string;
  evcNumber?: string;
  edahabNumber?: string;
  accountNumber?: string;
  /** Leave out to make one from the name. */
  invoicePrefix?: string;
}

export type UpdateCreditBranchInput = Partial<CreateCreditBranchInput>;

export const BRANCH_PAYMENT_METHODS = ["cash", "evc", "edahab", "bank"] as const;
export type BranchPaymentMethod = (typeof BRANCH_PAYMENT_METHODS)[number];

export function branchPaymentMethodLabel(method: BranchPaymentMethod): string {
  switch (method) {
    case "cash":
      return "Cash";
    case "evc":
      return "EVC Plus";
    case "edahab":
      return "eDahab";
    case "bank":
      return "Bank";
  }
}

export type BranchPaymentStatus = "pending" | "approved" | "rejected";

export interface BranchPayment {
  id: string;
  storeId: string;
  store: { id: string; name: string };
  branchCreditId: string | null;
  amount: number | string;
  paidAt: string;
  method: BranchPaymentMethod;
  reference: string | null;
  status: BranchPaymentStatus;
  submittedById: string;
  submittedBy: { id: string; name: string };
  reviewedById: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface SubmitBranchPaymentInput {
  amount: number;
  paidAt: string;
  method: BranchPaymentMethod;
  reference?: string;
}

export interface CreditStockItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreditStockInput {
  items: CreditStockItemInput[];
  paidAmount?: number;
  paidMethod?: BranchPaymentMethod;
  paidReference?: string;
  note?: string;
}

export interface BranchCreditItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number | string;
  unitCost: number | string;
  lineTotal: number | string;
  product: Product;
  returns: { quantity: number }[];
}

export interface BranchCredit {
  id: string;
  storeId: string;
  total: number | string;
  note: string | null;
  createdById: string;
  createdAt: string;
  items: BranchCreditItem[];
}

export interface CreateBranchReturnInput {
  branchCreditItemId: string;
  quantity: number;
  reason: string;
}

export interface BranchStatementRow {
  date: string;
  kind: "credit" | "return" | "payment";
  description: string;
  charge: number | null;
  credit: number | null;
  balance: number;
}

export type StatementOrder = "newest" | "oldest";

export interface BranchStatementQuery {
  page?: number;
  limit?: number;
  order?: StatementOrder;
}

export interface BranchStatement {
  rows: BranchStatementRow[];
  meta: PaginationMeta;
  balance: {
    totalCredited: number;
    totalReturned: number;
    totalPaid: number;
    totalPending: number;
    balance: number;
  };
}
