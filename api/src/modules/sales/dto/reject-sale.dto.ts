import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RejectSaleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
