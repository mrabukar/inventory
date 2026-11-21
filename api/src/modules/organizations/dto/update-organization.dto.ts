import { IsBoolean, MaxLength, IsOptional, IsString } from "class-validator";

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  hasStores?: boolean;

  @IsOptional()
  @IsBoolean()
  billingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** The host this organization signs in on. Empty clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(253)
  domain?: string | null;
}
