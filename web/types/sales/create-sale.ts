export interface CreateSaleItemInput {
  productId: string;
  quantitySold: number;
}

export interface CreateSaleInput {
  items: CreateSaleItemInput[];
  saleDate: string;
  customerId?: string;
  locationId?: string;
  /** Billing orgs only. Portion of the sale paid at recording time (0 = credit). */
  paidAmount?: number;
  note?: string;
}

export interface CorrectSaleItemInput {
  saleItemId: string;
  correctedQuantity: number;
}

export interface CorrectSaleInput {
  items: CorrectSaleItemInput[];
  reason: string;
}
