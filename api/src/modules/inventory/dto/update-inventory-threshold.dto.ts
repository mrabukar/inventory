import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class UpdateInventoryThresholdDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold!: number;
}
