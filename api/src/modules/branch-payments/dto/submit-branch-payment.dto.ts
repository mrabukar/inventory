import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { BRANCH_PAYMENT_METHODS } from "../../credit-branches/branch-payment.constants";

export class SubmitBranchPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsIn(BRANCH_PAYMENT_METHODS)
  method!: (typeof BRANCH_PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
