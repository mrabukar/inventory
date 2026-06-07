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

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  storeId?: string;

  @IsString()
  @IsNotEmpty()
  expenseDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
