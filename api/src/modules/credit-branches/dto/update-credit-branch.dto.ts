import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { BranchDetailsDto } from "./create-credit-branch.dto";

export class UpdateCreditBranchDto extends BranchDetailsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address?: string;
}
