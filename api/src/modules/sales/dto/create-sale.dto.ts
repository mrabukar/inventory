import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class SaleItemInputDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantitySold!: number;
}

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];

  @IsString()
  @IsNotEmpty()
  saleDate!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customerId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  locationId?: string;

  /** Billing orgs only. Portion of the sale paid at recording time (0 = credit). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
