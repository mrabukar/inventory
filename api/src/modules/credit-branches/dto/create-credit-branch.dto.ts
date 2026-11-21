import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

/**
 * Contact and payment details printed on the branch's own invoices (a credit
 * branch is its own business, so its invoices don't show the organization's).
 */
export class BranchDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  evcNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  edahabNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  accountNumber?: string;

  /** Letters and numbers only, 2–6 characters; stored in capitals. Defaults from the name. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{2,6}$/, {
    message: "Invoice prefix must be 2 to 6 letters or numbers",
  })
  invoicePrefix?: string;
}

export class CreateCreditBranchDto extends BranchDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;
}
