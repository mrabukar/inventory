import { BadRequestException } from "@nestjs/common";

export function assertPositiveSellingPrice(sellingPrice: number): void {
  if (sellingPrice <= 0) {
    throw new BadRequestException("Selling price must be greater than zero");
  }
}

export function assertSellingPriceNotBelowPurchase(
  purchasePrice: number,
  sellingPrice: number,
): void {
  if (sellingPrice < purchasePrice) {
    throw new BadRequestException(
      "Selling price cannot be lower than purchase price",
    );
  }
}
