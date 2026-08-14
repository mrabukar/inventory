import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCurrentOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  paymentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;
}
