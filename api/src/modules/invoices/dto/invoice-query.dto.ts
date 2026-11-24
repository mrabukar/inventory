import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class InvoiceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsIn(["unpaid", "partial", "paid"])
  status?: "unpaid" | "partial" | "paid";

  @IsOptional()
  @IsString()
  customerId?: string;

  /** A credit branch to browse (admin only). Leave out for the organization's own. */
  @IsOptional()
  @IsString()
  storeId?: string;
}
