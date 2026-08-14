import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateSaleLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
