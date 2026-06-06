import { IsIn, IsOptional, IsString } from "class-validator";
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
}
