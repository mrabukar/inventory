export interface CreateProductInput {
  name: string;
  categoryId: string;
  model?: string;
  description?: string;
  sellingPrice: number;
}
