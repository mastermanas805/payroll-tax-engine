import { PayBasis, Declarations, CalculationResult } from './breakdown.types';

/**
 * Persisted domain entities (D6 multi-tenant, D10 in-memory behind repos).
 * Every employee/run/payslip carries `employerId` for tenant isolation (NFR-4).
 * IDs are crypto.randomUUID() strings.
 */

/** The tenant / buyer. country is set at signup; employees inherit it (D7). */
export interface Employer {
  id: string;
  companyName: string;
  /** login email (unique). */
  email: string;
  /** bcrypt hash; never serialized to API responses. */
  passwordHash: string;
  /** ISO-3166 country code, e.g. "IN". */
  country: string;
  /** ISO-4217 currency, e.g. "INR". */
  currency: string;
  /** PT/state schedule selector, default "KA" (Karnataka) per §7. */
  state?: string;
  createdAt: string;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

/** An enrolled employee, owned by exactly one employer (FR-3, FR-4). */
export interface Employee {
  id: string;
  employerId: string;
  name: string;
  /** how salary is supplied. */
  payBasis: PayBasis;
  /** tax regime, e.g. "OLD" | "NEW". */
  regime: string;
  declarations: Declarations;
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
}

export type PayrollRunStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

/** One payroll run for a period across the employer's active employees (FR-9, FR-10). */
export interface PayrollRun {
  id: string;
  employerId: string;
  /** period label YYYY-MM. */
  period: string;
  status: PayrollRunStatus;
  /** number of payslips produced. */
  payslipCount: number;
  /** ids of employees that failed (per-employee failure isolation — NFR-6). */
  failedEmployeeIds?: string[];
  createdAt: string;
}

/** An immutable, auditable payslip; unique per (runId, employeeId) (FR-10, FR-11). */
export interface Payslip {
  id: string;
  employerId: string;
  runId: string;
  employeeId: string;
  period: string;
  /** the full structured, reconciled calculation result (FR-7, NFR-2). */
  result: CalculationResult;
  createdAt: string;
}
