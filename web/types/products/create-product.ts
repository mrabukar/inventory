export interface CreateProductInput {
  name: string;
  categoryId: number;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
}
