import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class OrganizationUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;
}
