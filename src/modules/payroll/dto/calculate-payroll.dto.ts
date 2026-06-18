import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Pay basis sub-DTO (D9: CTC or GROSS, CTC primary). Amount is the monthly
 * figure in the employer's currency.
 */
export class PayBasisDto {
  @IsIn(['CTC', 'GROSS'])
  type!: 'CTC' | 'GROSS';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

/** Employee tax declarations driving conditional / exemption rules (FR-4). */
export class DeclarationsDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rentPaid?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  section80C?: number;

  @IsOptional()
  @IsBoolean()
  metro?: boolean;

  @IsOptional()
  @IsString()
  nationality?: string;
}

/**
 * POST /api/v1/payroll/calculate body (UC-9 ad-hoc preview — NOT persisted).
 * employerId is NEVER accepted from the client; it comes from @CurrentEmployer.
 */
export class CalculatePayrollDto {
  /** tax regime, e.g. "OLD" | "NEW". */
  @IsString()
  regime!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PayBasisDto)
  payBasis!: PayBasisDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DeclarationsDto)
  declarations?: DeclarationsDto;

  /** period label YYYY-MM (drives ruleset resolution — NFR-5). */
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period!: string;
}
