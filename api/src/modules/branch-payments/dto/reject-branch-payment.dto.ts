import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RejectBranchPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
