import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { EmployeeStatus } from 'src/shared';
import { PayBasisDto } from './pay-basis.dto';
import { DeclarationsDto } from './declarations.dto';

/**
 * UpdateEmployeeDto — payload for PATCH /api/v1/employees/:id (FR-3, NFR-7).
 *
 * Every field optional (partial update); provided fields are validated with the
 * same rules as create (no negative amounts, valid regime/status). `id` and
 * `employerId` are never accepted from the body.
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name must not be empty' })
  name?: string;

  @IsOptional()
  @IsObject({ message: 'payBasis must be an object' })
  @ValidateNested()
  @Type(() => PayBasisDto)
  payBasis?: PayBasisDto;

  @IsOptional()
  @IsIn(['OLD', 'NEW'], { message: 'regime must be OLD or NEW' })
  regime?: 'OLD' | 'NEW';

  @IsOptional()
  @IsObject({ message: 'declarations must be an object' })
  @ValidateNested()
  @Type(() => DeclarationsDto)
  declarations?: DeclarationsDto;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'status must be ACTIVE or INACTIVE' })
  status?: EmployeeStatus;
}
