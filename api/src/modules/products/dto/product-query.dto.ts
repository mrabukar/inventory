import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;
}
