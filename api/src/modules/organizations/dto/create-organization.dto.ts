import { IsBoolean, MaxLength, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  hasStores?: boolean;

  /** The host this organization signs in on. Empty clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(253)
  domain?: string | null;
}
