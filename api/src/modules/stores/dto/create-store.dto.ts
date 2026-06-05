import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateStoreDto {
  @ApiProperty({ example: "Main Branch" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "123 Main St, Hargeisa" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;
}
