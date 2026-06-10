import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import {
  STOCK_SUPPLY_TYPES,
  type StockSupplyTypeValue,
} from "../stock-supply.constants";

export class StockSupplyQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsIn(STOCK_SUPPLY_TYPES)
  type?: StockSupplyTypeValue;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}
