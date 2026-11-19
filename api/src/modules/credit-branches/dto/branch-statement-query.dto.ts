import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export const STATEMENT_ORDERS = ["newest", "oldest"] as const;
export type StatementOrder = (typeof STATEMENT_ORDERS)[number];

export class BranchStatementQueryDto extends PaginationQueryDto {
  /**
   * Date order only. The Balance column is a running total, so ordering by
   * any other column would make it meaningless.
   */
  @IsOptional()
  @IsIn(STATEMENT_ORDERS)
  order: StatementOrder = "newest";
}
