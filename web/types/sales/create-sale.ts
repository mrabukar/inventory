export interface CreateSaleInput {
  productId: string;
  quantitySold: number;
  saleDate: string;
  note?: string;
}

export interface CorrectSaleInput {
  correctedQuantity: number;
  reason: string;
}
