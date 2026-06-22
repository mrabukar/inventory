import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class InventoryAlertQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;
}
