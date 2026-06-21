import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class SetOpeningCostDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitPurchasePrice!: number;

  @IsString()
  @IsNotEmpty()
  purchaseDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  newSellingPrice?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  acceptSellingBelowCost?: boolean;
}
