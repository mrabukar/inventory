import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class CorrectSaleItemDto {
  @IsString()
  @IsNotEmpty()
  saleItemId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  correctedQuantity!: number;
}

export class CorrectSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CorrectSaleItemDto)
  items!: CorrectSaleItemDto[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
