import { Injectable } from '@nestjs/common';
import {
  Employee,
  EmployeeRepository,
  FindEmployeesOptions,
} from 'src/shared';

/**
 * InMemoryEmployeeRepository — tenant-scoped in-memory adapter (D10, NFR-4).
 *
 * Implements the frozen EmployeeRepository port and is bound to EMPLOYEE_REPOSITORY
 * by EmployeesModule. EVERY query is scoped by `employerId` (sourced from the JWT via
 * @CurrentEmployer, never the client), so an employer can never read or mutate another
 * tenant's row — cross-tenant lookups simply return null / an empty list (zero IDOR).
 *
 * Stored objects are cloned on the way in and out so callers cannot mutate internal
 * state by reference (defensive copy; keeps the store the single source of truth).
 */
@Injectable()
export class InMemoryEmployeeRepository implements EmployeeRepository {
  /** id -> Employee. Tenancy is enforced by checking employerId on every access. */
  private readonly store = new Map<string, Employee>();

  create(employee: Employee): Employee {
    const record = this.clone(employee);
    this.store.set(record.id, record);
    return this.clone(record);
  }

  findByEmployer(employerId: string, opts?: FindEmployeesOptions): Employee[] {
    const activeOnly = opts?.activeOnly === true;
    const results: Employee[] = [];
    for (const employee of this.store.values()) {
      if (employee.employerId !== employerId) {
        continue;
      }
      if (activeOnly && employee.status !== 'ACTIVE') {
        continue;
      }
      results.push(this.clone(employee));
    }
    return results;
  }

  findOne(employerId: string, id: string): Employee | null {
    const employee = this.store.get(id);
    // Tenant guard at the data layer: only return rows owned by this employer.
    if (!employee || employee.employerId !== employerId) {
      return null;
    }
    return this.clone(employee);
  }

  update(employerId: string, id: string, patch: Partial<Employee>): Employee | null {
    const existing = this.store.get(id);
    if (!existing || existing.employerId !== employerId) {
      return null;
    }
    // Identity & ownership fields are immutable — never overwritten from a patch.
    const updated: Employee = {
      ...existing,
      ...patch,
      id: existing.id,
      employerId: existing.employerId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return this.clone(updated);
  }

  /**
   * Soft-deactivate an owned employee (DELETE is a status flip, never a hard delete —
   * payslip history must stay reproducible, NFR-2/NFR-5). Returns null if not owned.
   */
  deactivate(employerId: string, id: string): Employee | null {
    return this.update(employerId, id, { status: 'INACTIVE' });
  }

  /** Deep-ish clone so internal records are never handed out by reference. */
  private clone(employee: Employee): Employee {
    return {
      ...employee,
      payBasis: { ...employee.payBasis },
      declarations: { ...employee.declarations },
    };
  }
}
