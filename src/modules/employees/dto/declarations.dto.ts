import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Declarations } from 'src/shared';

/**
 * Employee tax declarations driving conditional/exemption rules (FR-4).
 * All fields optional; monetary fields reject negatives (NFR-7).
 */
export class DeclarationsDto implements Declarations {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'declarations.rentPaid must be a number' })
  @Min(0, { message: 'declarations.rentPaid must not be negative' })
  rentPaid?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'declarations.section80C must be a number' })
  @Min(0, { message: 'declarations.section80C must not be negative' })
  section80C?: number;

  @IsOptional()
  @IsBoolean({ message: 'declarations.metro must be a boolean' })
  metro?: boolean;

  @IsOptional()
  @IsString({ message: 'declarations.nationality must be a string' })
  nationality?: string;
}
