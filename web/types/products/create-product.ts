export interface CreateProductInput {
  name: string;
  categoryId: number;
  model?: string;
  description?: string;
  sellingPrice: number;
}
