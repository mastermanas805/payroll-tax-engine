import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import {
  EMPLOYEE_REPOSITORY,
  PAYROLL_RUN_REPOSITORY,
  PAYSLIP_REPOSITORY,
  RULESET_REPOSITORY,
  TAX_ENGINE,
  EmployeeRepository,
  PayrollRunRepository,
  PayslipRepository,
  RulesetRepository,
  TaxEngineService,
} from 'src/shared/contracts';
import {
  Employee,
  PayrollRun,
  PayrollRunStatus,
  Payslip,
} from 'src/shared/types/domain.types';
import {
  CalculationInput,
  CalculationResult,
  Declarations,
  PayBasis,
} from 'src/shared/types/breakdown.types';
import { RuleSet } from 'src/shared/types/ruleset.types';
import {
  RulesetNotFoundException,
  DuplicateRunException,
} from 'src/shared/exceptions';
import { M } from 'src/shared/money/money';

/** Country code for v1 (single-country-per-employer, D7). */
const DEFAULT_COUNTRY = 'IN';

/** Result of running payroll for a period, returned to the controller. */
export interface RunPayrollResult {
  run: PayrollRun;
  payslips: Payslip[];
  /** true when this call short-circuited on an existing run (idempotent replay). */
  replayed: boolean;
}

/**
 * PayrollService — orchestrates ad-hoc calculation (UC-9) and full payroll runs
 * (FR-5..FR-11). Codes ONLY against the injected interfaces (DIP, NFR-9): never
 * the concrete TaxEngine / repositories. Determinism, idempotency and
 * per-employee failure isolation (NFR-1, NFR-5, NFR-6) live here.
 */
@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  /**
   * Idempotency-key ledger, kept out of the frozen PayrollRun entity.
   * Key: "employerId|period" -> the Idempotency-Key that created that run.
   * Lets a safe retry (same key) replay instead of double-paying (NFR-6), while
   * a genuine duplicate (different/absent key) is rejected (NFR-7).
   */
  private readonly idempotencyLedger = new Map<string, string>();

  constructor(
    @Inject(TAX_ENGINE)
    private readonly taxEngine: TaxEngineService,
    @Inject(RULESET_REPOSITORY)
    private readonly rulesets: RulesetRepository,
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly employees: EmployeeRepository,
    @Inject(PAYROLL_RUN_REPOSITORY)
    private readonly runs: PayrollRunRepository,
    @Inject(PAYSLIP_REPOSITORY)
    private readonly payslips: PayslipRepository,
  ) {}

  /**
   * Ad-hoc calculation (UC-9): resolve the effective ruleset, run the engine,
   * return the breakdown. Does NOT persist anything. Throws RulesetNotFound when
   * no PUBLISHED ruleset is effective for (country, regime, period).
   */
  calculate(
    employerId: string,
    regime: string,
    payBasis: PayBasis,
    declarations: Declarations,
    period: string,
  ): CalculationResult {
    const ruleSet = this.resolveRulesetOrThrow(regime, period);
    const input: CalculationInput = {
      payBasis: this.toMonthly(payBasis),
      declarations: declarations ?? {},
      period,
      regime,
    };
    // Engine reconciles-or-throws (FR-8); we surface its result verbatim.
    return this.taxEngine.calculate(ruleSet, input);
  }

  /**
   * Run payroll for (employer, period) across all ACTIVE employees (FR-9, FR-10).
   *
   * Guarantees:
   *  - Idempotent per (employer, period): a second call with the same
   *    idempotencyKey returns the existing run instead of double-paying (NFR-6).
   *  - The ruleset per regime is resolved and PINNED ONCE at run start, so every
   *    payslip in the run is reproducible against the same version (NFR-5).
   *  - Per-employee failure isolation: one employee's failure never aborts the
   *    run; it is recorded in failedEmployeeIds and the run finishes PARTIAL.
   *  - Status COMPLETED when all active employees succeeded, PARTIAL otherwise.
   */
  runPayroll(
    employerId: string,
    period: string,
    idempotencyKey?: string,
  ): RunPayrollResult {
    // --- Idempotency check (NFR-6). A run already exists for this period => replay.
    const ledgerKey = `${employerId}|${period}`;
    const existing = this.runs.findByPeriod(employerId, period);
    if (existing) {
      // If an explicit idempotency key was supplied and it matches the key that
      // created this run, this is a safe retry: replay the existing run +
      // payslips. Otherwise it is a genuine duplicate attempt; reject loudly (NFR-7).
      const priorKey = this.idempotencyLedger.get(ledgerKey);
      const sameKey = !idempotencyKey || !priorKey || priorKey === idempotencyKey;
      if (sameKey) {
        return {
          run: existing,
          payslips: this.payslips.findByRun(employerId, existing.id),
          replayed: true,
        };
      }
      throw new DuplicateRunException(
        'A payroll run already exists for this period',
        { period, existingRunId: existing.id },
      );
    }

    const activeEmployees = this.employees.findByEmployer(employerId, { activeOnly: true });

    // Pin one ruleset per distinct regime present in the active roster, ONCE, at
    // run start (NFR-5). resolveRulesetOrThrow throws RulesetNotFound if any
    // required (regime, period) has no effective ruleset — we fail fast BEFORE
    // creating the run so we never persist a half-resolvable run.
    const pinnedRulesets = this.pinRulesetsForRoster(activeEmployees, period);

    // Create the run up front in PENDING so it is discoverable / resumable.
    const run: PayrollRun = {
      id: randomUUID(),
      employerId,
      period,
      status: 'PENDING',
      payslipCount: 0,
      failedEmployeeIds: [],
      createdAt: new Date().toISOString(),
    };
    this.runs.create(run);
    if (idempotencyKey) {
      this.idempotencyLedger.set(ledgerKey, idempotencyKey);
    }

    const producedPayslips: Payslip[] = [];
    const failedEmployeeIds: string[] = [];
    let totalEmployerCost = new Decimal(0);

    for (const employee of activeEmployees) {
      try {
        const payslip = this.computeAndPersistPayslip(
          employerId,
          run.id,
          period,
          employee,
          pinnedRulesets,
        );
        producedPayslips.push(payslip);
        totalEmployerCost = totalEmployerCost.plus(M(payslip.result.summary.totalEmployerCost));
      } catch (err) {
        // Per-employee failure isolation (NFR-6): record + continue.
        failedEmployeeIds.push(employee.id);
        this.logger.error(
          `Payroll failed for employee=${employee.id} run=${run.id} period=${period}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const status: PayrollRunStatus = this.deriveStatus(activeEmployees.length, failedEmployeeIds.length);

    const updated = this.runs.update(employerId, run.id, {
      status,
      payslipCount: producedPayslips.length,
      failedEmployeeIds: failedEmployeeIds.length ? failedEmployeeIds : undefined,
    });

    // Aggregate run summary (totalEmployerCost, reconciled). The run reconciles
    // when the count of produced payslips + failures equals the active roster.
    const reconciled =
      producedPayslips.length + failedEmployeeIds.length === activeEmployees.length;
    this.logger.log(
      `Run ${run.id} period=${period} status=${status} payslips=${producedPayslips.length} ` +
        `failed=${failedEmployeeIds.length} totalEmployerCost=${totalEmployerCost.toFixed(2)} ` +
        `reconciled=${reconciled}`,
    );

    return {
      run: updated ?? { ...run, status, payslipCount: producedPayslips.length },
      payslips: producedPayslips,
      replayed: false,
    };
  }

  /**
   * Compute one employee's payslip against the pinned ruleset and persist it.
   * Idempotent per (run, employee): if a payslip already exists it is returned
   * rather than recomputed (NFR-6).
   */
  private computeAndPersistPayslip(
    employerId: string,
    runId: string,
    period: string,
    employee: Employee,
    pinnedRulesets: Map<string, RuleSet>,
  ): Payslip {
    const existing = this.payslips.findByRunAndEmployee(employerId, runId, employee.id);
    if (existing) {
      return existing;
    }

    const ruleSet = pinnedRulesets.get(employee.regime);
    if (!ruleSet) {
      // Should not happen: roster was fully pinned at run start. Defensive.
      throw new RulesetNotFoundException('No pinned ruleset for employee regime', {
        regime: employee.regime,
        period,
      });
    }

    const input: CalculationInput = {
      payBasis: this.toMonthly(employee.payBasis),
      declarations: employee.declarations ?? {},
      period,
      regime: employee.regime,
    };

    // Engine reconciles-or-throws (FR-8); a non-reconciling payslip is never persisted.
    const result: CalculationResult = this.taxEngine.calculate(ruleSet, input);

    const payslip: Payslip = {
      id: randomUUID(),
      employerId,
      runId,
      employeeId: employee.id,
      period,
      result,
      createdAt: new Date().toISOString(),
    };
    return this.payslips.create(payslip);
  }

  /**
   * Resolve + pin one ruleset per distinct regime across the active roster, ONCE
   * at run start (NFR-5). Throws RulesetNotFound (fail-fast) if any regime lacks
   * an effective ruleset, so we never start a run we can't fully compute.
   */
  private pinRulesetsForRoster(employees: Employee[], period: string): Map<string, RuleSet> {
    const pinned = new Map<string, RuleSet>();
    const regimes = new Set(employees.map((e) => e.regime));
    for (const regime of regimes) {
      pinned.set(regime, this.resolveRulesetOrThrow(regime, period));
    }
    return pinned;
  }

  /** Resolve the effective PUBLISHED ruleset or throw RulesetNotFound (FR-12, NFR-5). */
  private resolveRulesetOrThrow(regime: string, period: string): RuleSet {
    const ruleSet = this.rulesets.resolve(DEFAULT_COUNTRY, regime, period);
    if (!ruleSet) {
      throw new RulesetNotFoundException(
        `No effective ruleset for ${DEFAULT_COUNTRY}/${regime} at ${period}`,
        { country: DEFAULT_COUNTRY, regime, period },
      );
    }
    return ruleSet;
  }

  /**
   * The stored CTC/Gross is ANNUAL; payroll runs on a monthly cycle (§7), so we
   * normalize the input to one month before the engine runs. The rulesets' statutory
   * thresholds (EPF ceiling 15000, ESI limit 21000, PT) are monthly and the
   * income-tax rule re-annualizes internally (12*Gross), so feeding a monthly base
   * makes every figure correct and keeps the payslip a true monthly payslip.
   */
  private toMonthly(payBasis: PayBasis): PayBasis {
    return { type: payBasis.type, amount: M(payBasis.amount).div(12).toNumber() };
  }

  private deriveStatus(total: number, failures: number): PayrollRunStatus {
    if (total === 0) {
      // Nothing to run; treat an empty roster as a (vacuously) completed run.
      return 'COMPLETED';
    }
    if (failures === 0) {
      return 'COMPLETED';
    }
    if (failures >= total) {
      return 'FAILED';
    }
    return 'PARTIAL';
  }

  // ----- Read-side helpers used by the controller (tenant-scoped — NFR-4) -----

  listRuns(employerId: string): PayrollRun[] {
    return this.runs.findByEmployer(employerId);
  }

  getRun(employerId: string, runId: string): PayrollRun | null {
    return this.runs.findOne(employerId, runId);
  }

  getRunPayslips(employerId: string, runId: string): Payslip[] {
    return this.payslips.findByRun(employerId, runId);
  }

  getPayslip(employerId: string, payslipId: string): Payslip | null {
    return this.payslips.findOne(employerId, payslipId);
  }
}
