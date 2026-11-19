import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { BRANCH_PAYMENT_METHODS } from "../branch-payment.constants";

export class CreditStockItemDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class CreditStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditStockItemDto)
  items!: CreditStockItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsIn(BRANCH_PAYMENT_METHODS)
  paidMethod?: (typeof BRANCH_PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paidReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
