import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class WarehouseStockWriteOffDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;
}
