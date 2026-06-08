import { BadRequestException } from "@nestjs/common";

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
