export interface PaymentInvoiceSummary {
  id: string;
  numberLabel: string;
  total: number | string;
  /** The branch the sale belongs to. */
  sale?: { store: { id: string; name: string } };
}

export interface PaymentCustomerSummary {
  id: string;
  name: string;
}

export interface PaymentRecordedBy {
  id: string;
  name: string;
  email: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string | null;
  amount: number | string;
  paidAt: string;
  note: string | null;
  recordedById: string | null;
  createdAt: string;
  /** "payment" = standalone cash payment; "sale" = collected at sale time. */
  source?: "payment" | "sale";
  invoice: PaymentInvoiceSummary;
  customer: PaymentCustomerSummary | null;
  recordedBy: PaymentRecordedBy | null;
}

export interface PaymentListQuery {
  /** A credit branch to browse (admin only). */
  storeId?: string;
  page?: number;
  limit?: number;
  customerId?: string;
  invoiceId?: string;
}

export interface CreatePaymentInput {
  customerId: string;
  invoiceId?: string;
  amount: number;
  paidAt: string;
  note?: string;
}

export interface CustomerBalance {
  totalBilled: number;
  totalPaid: number;
  balance: number;
  unpaidInvoiceCount: number;
}

export interface CustomerStatementRow {
  kind: "invoice" | "payment";
  date: string;
  reference: string;
  description: string;
  charge: number | null;
  payment: number | null;
  balance: number;
}

export interface CustomerStatement {
  rows: CustomerStatementRow[];
  summary: CustomerBalance;
}

export interface ReceivableRow {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    store?: { id: string; name: string } | null;
  } | null;
  unpaidInvoiceCount: number;
  balance: number;
}
