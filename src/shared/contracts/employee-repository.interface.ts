import { Employee } from '../types/domain.types';

/** Filter options for listing employees within a tenant. */
export interface FindEmployeesOptions {
  /** if true, only ACTIVE employees (used by payroll runs). */
  activeOnly?: boolean;
}

/**
 * EmployeeRepository — tenant-scoped persistence port (DIP, D10; NFR-4).
 * EVERY method takes `employerId` first; never trust a client-supplied one
 * (it comes from @CurrentEmployer / the JWT). Bind to EMPLOYEE_REPOSITORY.
 */
export interface EmployeeRepository {
  /** Persist a new employee under `employerId`. */
  create(employee: Employee): Promise<Employee>;

  /** List employees for `employerId` (optionally active-only). */
  findByEmployer(employerId: string, opts?: FindEmployeesOptions): Promise<Employee[]>;

  /** Fetch one employee by id, scoped to `employerId`; null if not owned/found. */
  findOne(employerId: string, id: string): Promise<Employee | null>;

  /** Apply a partial update to an owned employee; returns the updated entity or null. */
  update(employerId: string, id: string, patch: Partial<Employee>): Promise<Employee | null>;
}
