export interface CreateProductInput {
  name: string;
  categoryId: number;
  model?: string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
}
