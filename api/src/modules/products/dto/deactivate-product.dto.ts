import { IsBoolean, IsOptional } from "class-validator";

export class DeactivateProductDto {
  /** When true, deactivate even if quantity remains at one or more stores. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
