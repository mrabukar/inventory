import { UserRole } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
