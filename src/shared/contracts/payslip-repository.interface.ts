import { Payslip } from '../types/domain.types';

/**
 * PayslipRepository — tenant-scoped, append-only persistence port (DIP, D10; NFR-2/NFR-4).
 * Payslips are immutable; exactly-one per (runId, employeeId) (FR-10, NFR-6).
 * Bind a concrete impl to the PAYSLIP_REPOSITORY token.
 */
export interface PayslipRepository {
  /** Persist an immutable payslip under its employerId. */
  create(payslip: Payslip): Promise<Payslip>;

  /** Fetch one payslip by id, scoped to `employerId`; null if not owned/found. */
  findOne(employerId: string, id: string): Promise<Payslip | null>;

  /** List payslips for a run, scoped to `employerId`. */
  findByRun(employerId: string, runId: string): Promise<Payslip[]>;

  /** Idempotency lookup (NFR-6): existing payslip for (runId, employeeId), or null. */
  findByRunAndEmployee(employerId: string, runId: string, employeeId: string): Promise<Payslip | null>;

  /** List payslips for an employee, scoped to `employerId`. */
  findByEmployee(employerId: string, employeeId: string): Promise<Payslip[]>;
}
