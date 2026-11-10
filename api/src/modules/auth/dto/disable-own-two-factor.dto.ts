import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class DisableOwnTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "Enter the 6-digit code from your app" })
  code!: string;
}
