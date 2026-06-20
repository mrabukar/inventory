import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateCurrentOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
