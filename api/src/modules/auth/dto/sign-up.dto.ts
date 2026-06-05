import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { USER_ROLES, UserRole } from "../auth.constants";
import { IsStrongPassword } from "../validators/password-strength.validator";

export class SignUpDto {
  @ApiProperty({ example: "admin@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({
    example: "Password1!",
    minLength: 8,
    description:
      "Min 8 chars; requires uppercase, digit, and special character",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ example: "Admin User" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: USER_ROLES, example: "admin" })
  @IsIn(USER_ROLES)
  role!: UserRole;

  @ApiPropertyOptional({
    example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    description:
      "UUID v4 of the store; required for branch_manager; not allowed for admin",
  })
  @IsOptional()
  @IsUUID("4")
  storeId?: string;
}
