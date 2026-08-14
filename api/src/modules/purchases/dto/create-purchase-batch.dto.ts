import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { CreatePurchaseBatchItemDto } from "./create-purchase-batch-item.dto";

export class CreatePurchaseBatchDto {
  @IsString()
  @IsNotEmpty()
  purchaseDate!: string;

  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseBatchItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items!: CreatePurchaseBatchItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
