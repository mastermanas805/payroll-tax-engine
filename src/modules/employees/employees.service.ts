import { randomUUID } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EMPLOYEE_REPOSITORY,
  Employee,
  EmployeeRepository,
  FindEmployeesOptions,
} from 'src/shared';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/**
 * EmployeesService — tenant-scoped employee management (FR-3, FR-4).
 *
 * Depends on the EmployeeRepository PORT (DIP), injected by the EMPLOYEE_REPOSITORY
 * token — never on the concrete class. Every method takes `employerId` (from the JWT
 * via @CurrentEmployer in the controller) and forwards it as the first argument so the
 * repository can enforce isolation. A missing row (not found OR not owned) surfaces as
 * a 404 so we never leak the existence of another tenant's employee (NFR-4, NFR-7).
 */
@Injectable()
export class EmployeesService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly employees: EmployeeRepository,
  ) {}

  /** Enroll a new employee under `employerId`. Defaults: status ACTIVE, empty declarations. */
  create(employerId: string, dto: CreateEmployeeDto): Employee {
    const now = new Date().toISOString();
    const employee: Employee = {
      id: randomUUID(),
      employerId,
      name: dto.name,
      payBasis: { type: dto.payBasis.type, amount: dto.payBasis.amount },
      regime: dto.regime,
      declarations: dto.declarations ? { ...dto.declarations } : {},
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    return this.employees.create(employee);
  }

  /** List this employer's employees (optionally active-only, used by payroll runs). */
  findAll(employerId: string, opts?: FindEmployeesOptions): Employee[] {
    return this.employees.findByEmployer(employerId, opts);
  }

  /** Fetch one owned employee or throw 404 (also covers cross-tenant IDOR attempts). */
  findOne(employerId: string, id: string): Employee {
    const employee = this.employees.findOne(employerId, id);
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return employee;
  }

  /** Apply a partial update to an owned employee; 404 if not found/owned. */
  update(employerId: string, id: string, dto: UpdateEmployeeDto): Employee {
    const patch: Partial<Employee> = {};
    if (dto.name !== undefined) {
      patch.name = dto.name;
    }
    if (dto.payBasis !== undefined) {
      patch.payBasis = { type: dto.payBasis.type, amount: dto.payBasis.amount };
    }
    if (dto.regime !== undefined) {
      patch.regime = dto.regime;
    }
    if (dto.declarations !== undefined) {
      patch.declarations = { ...dto.declarations };
    }
    if (dto.status !== undefined) {
      patch.status = dto.status;
    }

    const updated = this.employees.update(employerId, id, patch);
    if (!updated) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return updated;
  }

  /**
   * Soft-deactivate (DELETE endpoint). Flips status to INACTIVE via the repository
   * update port — never a hard delete, so payslip history stays reproducible (NFR-2).
   * 404 if not found/owned.
   */
  deactivate(employerId: string, id: string): Employee {
    const updated = this.employees.update(employerId, id, { status: 'INACTIVE' });
    if (!updated) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    return updated;
  }
}
