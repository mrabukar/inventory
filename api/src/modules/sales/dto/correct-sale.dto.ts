import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";

export class CorrectSaleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  correctedQuantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
