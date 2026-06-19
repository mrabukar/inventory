import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsBoolean()
  hasStores?: boolean;
}
