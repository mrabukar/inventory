import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class SignInDto {
  @ApiProperty({ example: "admin@example.com" })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: "Password1" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
