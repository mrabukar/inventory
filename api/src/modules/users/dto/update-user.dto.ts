import { UserRole } from "@prisma/client";
import {
  IsEmail,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { LIMITED_PAGE_KEYS } from "../../../common/access/limited-pages";
import { ASSIGNABLE_USER_ROLES } from "../../auth/auth.constants";
import { IsStrongPassword } from "../../auth/validators/password-strength.validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @IsStrongPassword()
  password?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  /** For a limited user: the pages they may see. Admins only. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(LIMITED_PAGE_KEYS as readonly string[], { each: true })
  allowedPages?: string[];
}
