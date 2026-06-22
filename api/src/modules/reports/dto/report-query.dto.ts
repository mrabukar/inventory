import { Type } from "class-transformer";
import { IsNotEmpty, IsOptional, IsPositive, IsString } from "class-validator";

export class ReportQueryDto {
  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  categoryId?: string;
}
