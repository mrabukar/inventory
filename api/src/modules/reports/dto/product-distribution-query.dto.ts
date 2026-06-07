import { OmitType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import { IsInt, IsPositive } from "class-validator";
import { ReportQueryDto } from "./report-query.dto";

/** Product distribution — same date/store filters as reports, but categoryId is required. */
export class ProductDistributionQueryDto extends OmitType(ReportQueryDto, [
  "categoryId",
] as const) {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId: number;
}
