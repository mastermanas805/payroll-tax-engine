import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PayBasisDto } from './pay-basis.dto';
import { DeclarationsDto } from './declarations.dto';

/**
 * CreateEmployeeDto — payload for POST /api/v1/employees (FR-3, FR-4, NFR-7).
 *
 * The global ValidationPipe ({ whitelist, transform }) strips unknown props and
 * coerces nested objects into these classes so @ValidateNested fires. `employerId`
 * is intentionally absent — it comes from @CurrentEmployer (the JWT), never the body.
 */
export class CreateEmployeeDto {
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name must not be empty' })
  name!: string;

  @IsDefined({ message: 'payBasis is required' })
  @IsObject({ message: 'payBasis must be an object' })
  @ValidateNested()
  @Type(() => PayBasisDto)
  payBasis!: PayBasisDto;

  @IsIn(['OLD', 'NEW'], { message: 'regime must be OLD or NEW' })
  regime!: 'OLD' | 'NEW';

  @IsOptional()
  @IsObject({ message: 'declarations must be an object' })
  @ValidateNested()
  @Type(() => DeclarationsDto)
  declarations?: DeclarationsDto;
}
