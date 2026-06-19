import { Type } from "class-transformer";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class OrganizationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => String)
  search?: string;
}
