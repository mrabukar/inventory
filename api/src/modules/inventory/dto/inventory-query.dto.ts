import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class InventoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId?: number;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === "true",
  )
  @IsBoolean()
  lowStockOnly?: boolean;
}
