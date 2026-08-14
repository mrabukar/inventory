export interface SaleLocation {
  id: string;
  name: string;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
}

export interface CreateSaleLocationInput {
  name: string;
}
