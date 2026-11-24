import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class PaymentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  /** A credit branch to browse (admin only). Leave out for the organization's own. */
  @IsOptional()
  @IsString()
  storeId?: string;
}
