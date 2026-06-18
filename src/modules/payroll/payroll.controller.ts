import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { TenantGuard } from 'src/shared/tenancy';
import { CurrentEmployer } from 'src/shared/tenancy/current-employer.decorator';
import { CalculationResult } from 'src/shared/types/breakdown.types';
import { PayrollRun, Payslip } from 'src/shared/types/domain.types';

import { PayrollService } from './payroll.service';
import { CalculatePayrollDto } from './dto/calculate-payroll.dto';
import { RunPayrollDto } from './dto/run-payroll.dto';

/** Shape returned by POST /payroll/runs. */
interface RunPayrollResponse {
  run: PayrollRun;
  payslips: Payslip[];
}

/**
 * PayrollController — orchestration endpoints (FR-5, FR-9, FR-10, FR-11).
 * Every route is behind TenantGuard; the tenant is read via @CurrentEmployer,
 * never from the client body (NFR-4). employerId is therefore always trustworthy.
 */
@Controller('payroll')
@UseGuards(TenantGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * POST /api/v1/payroll/calculate — ad-hoc preview (UC-9). Resolves the
   * effective ruleset, runs the engine, returns the breakdown. Persists nothing.
   * 404 RULESET_NOT_FOUND (via filter) when no ruleset is effective.
   */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(
    @CurrentEmployer() employerId: string,
    @Body() dto: CalculatePayrollDto,
  ): Promise<CalculationResult> {
    return this.payrollService.calculate(
      employerId,
      dto.regime,
      { type: dto.payBasis.type, amount: dto.payBasis.amount },
      dto.declarations ?? {},
      dto.period,
    );
  }

  /**
   * POST /api/v1/payroll/runs — run payroll for a period across active employees
   * (FR-9, FR-10). The Idempotency-Key header makes safe retries replay instead
   * of double-paying (NFR-6). 409 DUPLICATE_RUN on a genuine duplicate (NFR-7).
   */
  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  async runPayroll(
    @CurrentEmployer() employerId: string,
    @Body() dto: RunPayrollDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<RunPayrollResponse> {
    const { run, payslips } = await this.payrollService.runPayroll(
      employerId,
      dto.period,
      idempotencyKey,
    );
    return { run, payslips };
  }

  /** GET /api/v1/payroll/runs — list this employer's runs (newest first). */
  @Get('runs')
  listRuns(@CurrentEmployer() employerId: string): Promise<PayrollRun[]> {
    return this.payrollService.listRuns(employerId);
  }

  /** GET /api/v1/payroll/runs/:id — one run, tenant-scoped. 404 if not owned/found. */
  @Get('runs/:id')
  async getRun(
    @CurrentEmployer() employerId: string,
    @Param('id') id: string,
  ): Promise<PayrollRun> {
    const run = await this.payrollService.getRun(employerId, id);
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    return run;
  }

  /** GET /api/v1/payroll/runs/:id/payslips — payslips for a run, tenant-scoped. */
  @Get('runs/:id/payslips')
  async getRunPayslips(
    @CurrentEmployer() employerId: string,
    @Param('id') id: string,
  ): Promise<Payslip[]> {
    // 404 the parent run if it doesn't belong to this tenant (avoid leaking existence).
    const run = await this.payrollService.getRun(employerId, id);
    if (!run) {
      throw new NotFoundException('Payroll run not found');
    }
    return this.payrollService.getRunPayslips(employerId, id);
  }
}

/**
 * PayslipController — payslip retrieval (FR-11). Separate top-level resource so
 * the route is GET /api/v1/payslips/:id. Behind TenantGuard; tenant-scoped read.
 */
@Controller('payslips')
@UseGuards(TenantGuard)
export class PayslipController {
  constructor(private readonly payrollService: PayrollService) {}

  /** GET /api/v1/payslips/:id — one payslip with full breakdown + audit trace. */
  @Get(':id')
  async getPayslip(
    @CurrentEmployer() employerId: string,
    @Param('id') id: string,
  ): Promise<Payslip> {
    const payslip = await this.payrollService.getPayslip(employerId, id);
    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }
    return payslip;
  }
}
