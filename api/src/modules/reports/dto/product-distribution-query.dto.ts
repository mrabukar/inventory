import { OmitType } from "@nestjs/mapped-types";
import { IsNotEmpty, IsString } from "class-validator";
import { ReportQueryDto } from "./report-query.dto";

/** Product distribution — same date/store filters as reports, but categoryId is required. */
export class ProductDistributionQueryDto extends OmitType(ReportQueryDto, [
  "categoryId",
] as const) {
  @IsString()
  @IsNotEmpty()
  categoryId: string;
}
