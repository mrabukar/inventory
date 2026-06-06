import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateStockSupplyDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  storeId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitPurchasePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
