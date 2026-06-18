import { IsString, Matches } from 'class-validator';

/**
 * POST /api/v1/payroll/runs body (FR-9). The idempotency key is read from the
 * `Idempotency-Key` header by the controller, not the body. employerId comes
 * from @CurrentEmployer, never the client.
 */
export class RunPayrollDto {
  /** period label YYYY-MM to run payroll for. */
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period!: string;
}
