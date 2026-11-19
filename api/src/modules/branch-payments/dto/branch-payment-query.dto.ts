import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { BRANCH_PAYMENT_STATUSES } from "../../credit-branches/branch-payment.constants";

/** Columns a payment list may be sorted by (a whitelist, never raw input). */
export const BRANCH_PAYMENT_SORT_FIELDS = [
  "createdAt",
  "amount",
  "paidAt",
] as const;

export class BranchPaymentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(BRANCH_PAYMENT_STATUSES)
  status?: (typeof BRANCH_PAYMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsIn(BRANCH_PAYMENT_SORT_FIELDS)
  sortBy: (typeof BRANCH_PAYMENT_SORT_FIELDS)[number] = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  order: "asc" | "desc" = "desc";
}
