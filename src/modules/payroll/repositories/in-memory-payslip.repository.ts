import { Injectable } from '@nestjs/common';
import { Payslip } from 'src/shared/types/domain.types';
import { PayslipRepository } from 'src/shared/contracts';

/**
 * In-memory PayslipRepository (D10). Append-only / immutable (NFR-2): once a
 * payslip is created it is never mutated. Tenant-scoped (NFR-4) and enforces
 * exactly-one payslip per (runId, employeeId) (FR-10, NFR-6) so retries can
 * never double-pay. Bound to PAYSLIP_REPOSITORY and exported from PayrollModule.
 */
@Injectable()
export class InMemoryPayslipRepository implements PayslipRepository {
  /** payslipId -> payslip. */
  private readonly payslips = new Map<string, Payslip>();
  /** "employerId|runId|employeeId" -> payslipId, enforcing the unique constraint. */
  private readonly uniqueIndex = new Map<string, string>();

  async create(payslip: Payslip): Promise<Payslip> {
    const uniqueKey = this.uniqueKey(payslip.employerId, payslip.runId, payslip.employeeId);
    const existingId = this.uniqueIndex.get(uniqueKey);
    if (existingId) {
      // Idempotent: a payslip for this (run, employee) already exists; return it
      // rather than emitting a duplicate (exactly-once — NFR-6).
      return { ...this.payslips.get(existingId)! };
    }
    const stored: Payslip = { ...payslip };
    this.payslips.set(stored.id, stored);
    this.uniqueIndex.set(uniqueKey, stored.id);
    return { ...stored };
  }

  async findOne(employerId: string, id: string): Promise<Payslip | null> {
    const payslip = this.payslips.get(id);
    if (!payslip || payslip.employerId !== employerId) {
      return null;
    }
    return { ...payslip };
  }

  async findByRun(employerId: string, runId: string): Promise<Payslip[]> {
    return Array.from(this.payslips.values())
      .filter((p) => p.employerId === employerId && p.runId === runId)
      .map((p) => ({ ...p }));
  }

  async findByRunAndEmployee(employerId: string, runId: string, employeeId: string): Promise<Payslip | null> {
    const id = this.uniqueIndex.get(this.uniqueKey(employerId, runId, employeeId));
    if (!id) {
      return null;
    }
    const payslip = this.payslips.get(id);
    return payslip ? { ...payslip } : null;
  }

  async findByEmployee(employerId: string, employeeId: string): Promise<Payslip[]> {
    return Array.from(this.payslips.values())
      .filter((p) => p.employerId === employerId && p.employeeId === employeeId)
      .map((p) => ({ ...p }));
  }

  private uniqueKey(employerId: string, runId: string, employeeId: string): string {
    return `${employerId}|${runId}|${employeeId}`;
  }
}
