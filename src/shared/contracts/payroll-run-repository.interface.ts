import { PayrollRun } from '../types/domain.types';

/**
 * PayrollRunRepository — tenant-scoped persistence port (DIP, D10; NFR-4).
 * Bind a concrete impl to the PAYROLL_RUN_REPOSITORY token.
 */
export interface PayrollRunRepository {
  /** Persist a new run under its employerId. */
  create(run: PayrollRun): PayrollRun;

  /** List runs for `employerId`. */
  findByEmployer(employerId: string): PayrollRun[];

  /** Fetch one run by id, scoped to `employerId`; null if not owned/found. */
  findOne(employerId: string, id: string): PayrollRun | null;

  /** Idempotency check (NFR-6): existing run for (employerId, period), or null. */
  findByPeriod(employerId: string, period: string): PayrollRun | null;

  /** Apply a partial update (status, counts) to an owned run; returns it or null. */
  update(employerId: string, id: string, patch: Partial<PayrollRun>): PayrollRun | null;
}
