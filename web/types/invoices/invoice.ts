import type { PaginatedResponse } from "@/types/common/pagination";
import type { Customer } from "@/types/customers/customer";
import type { SaleItem, SaleSoldBy } from "@/types/sales/sale";
import type { SaleLocation } from "@/types/sales/sale-location";

export type InvoiceStatus = "unpaid" | "partial" | "paid";

export interface InvoiceOrganization {
  id: string;
  name: string;
  phone: string | null;
  evcNumber: string | null;
  edahabNumber: string | null;
  accountNumber: string | null;
  address: string | null;
  logoKey: string | null;
  stampKey: string | null;
}

export interface InvoiceSale {
  id: string;
  saleDate: string;
  status: string;
  totalAmount: number | string;
  note: string | null;
  items: SaleItem[];
  soldBy: SaleSoldBy;
  location: SaleLocation | null;
}

export interface Invoice {
  id: string;
  saleId: string;
  customerId: string | null;
  number: number;
  numberLabel: string;
  total: number | string;
  /** Amount paid at the time of sale — stored directly on the invoice. */
  paidAtSale: number | string;
  paidAmount: number | string;
  status: InvoiceStatus;
  issuedAt: string;
  customer: Customer | null;
  sale: InvoiceSale;
  organization: InvoiceOrganization;
}

export interface InvoiceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
}

export type InvoiceListResponse = PaginatedResponse<Invoice>;
