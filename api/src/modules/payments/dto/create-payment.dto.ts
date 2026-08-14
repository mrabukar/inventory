import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  /** Optional — defaults to the customer's oldest unpaid invoice. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  invoiceId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  paidAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
