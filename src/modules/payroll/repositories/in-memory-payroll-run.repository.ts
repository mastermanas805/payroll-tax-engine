import { Injectable } from '@nestjs/common';
import { PayrollRun } from 'src/shared/types/domain.types';
import { PayrollRunRepository } from 'src/shared/contracts';

/**
 * In-memory PayrollRunRepository (D10). Tenant-scoped: every read takes the
 * employerId from @CurrentEmployer / the JWT and a run is only ever returned to
 * the employer that owns it (NFR-4). Bound to the PAYROLL_RUN_REPOSITORY token
 * and exported from PayrollModule.
 */
@Injectable()
export class InMemoryPayrollRunRepository implements PayrollRunRepository {
  /** runId -> run. */
  private readonly runs = new Map<string, PayrollRun>();

  async create(run: PayrollRun): Promise<PayrollRun> {
    // Store a defensive copy so external mutation can't corrupt the store.
    const stored: PayrollRun = { ...run, failedEmployeeIds: run.failedEmployeeIds ? [...run.failedEmployeeIds] : undefined };
    this.runs.set(stored.id, stored);
    return { ...stored };
  }

  async findByEmployer(employerId: string): Promise<PayrollRun[]> {
    return Array.from(this.runs.values())
      .filter((r) => r.employerId === employerId)
      .map((r) => ({ ...r }))
      // newest first
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  async findOne(employerId: string, id: string): Promise<PayrollRun | null> {
    const run = this.runs.get(id);
    if (!run || run.employerId !== employerId) {
      return null;
    }
    return { ...run };
  }

  async findByPeriod(employerId: string, period: string): Promise<PayrollRun | null> {
    const match = Array.from(this.runs.values()).find(
      (r) => r.employerId === employerId && r.period === period,
    );
    return match ? { ...match } : null;
  }

  async update(employerId: string, id: string, patch: Partial<PayrollRun>): Promise<PayrollRun | null> {
    const run = this.runs.get(id);
    if (!run || run.employerId !== employerId) {
      return null;
    }
    // employerId / id are identity and never patched.
    const next: PayrollRun = { ...run, ...patch, id: run.id, employerId: run.employerId };
    this.runs.set(id, next);
    return { ...next };
  }
}
