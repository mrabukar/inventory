import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateSaleDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantitySold!: number;

  @IsString()
  @IsNotEmpty()
  saleDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
