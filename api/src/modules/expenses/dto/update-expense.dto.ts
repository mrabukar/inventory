import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId?: number;

  @IsOptional()
  @ValidateIf((_obj, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  storeId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
