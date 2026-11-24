import { IsOptional, IsString } from "class-validator";

export class ReceivablesQueryDto {
  /** A credit branch to browse (admin only). Leave out for the organization's own. */
  @IsOptional()
  @IsString()
  storeId?: string;
}
