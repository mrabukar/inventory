import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  ORGANIZATION_TYPES,
  type OrganizationType,
} from "../../../common/utils/organization-type.util";

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(ORGANIZATION_TYPES)
  type?: OrganizationType;

  /** Only for organizations with stores; direct and credit organizations always bill. */
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
