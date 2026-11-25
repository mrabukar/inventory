import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  ORGANIZATION_TYPES,
  type OrganizationType,
} from "../../../common/utils/organization-type.util";

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  /** Defaults to "stores". */
  @IsOptional()
  @IsIn(ORGANIZATION_TYPES)
  type?: OrganizationType;

  /** The host this organization signs in on. Empty clears it. */
  @IsOptional()
  @IsString()
  @MaxLength(253)
  domain?: string | null;
}
