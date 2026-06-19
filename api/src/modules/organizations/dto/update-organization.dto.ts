import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  hasStores?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
