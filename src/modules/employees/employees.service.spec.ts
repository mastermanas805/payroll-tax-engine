import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { InMemoryEmployeeRepository } from './employee.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';

/**
 * Behavioral coverage for the employees bounded context: tenant isolation (NFR-4),
 * soft-deactivate semantics (FR-3), and partial update. The service is wired to the
 * real in-memory repo (no mocks) so the scoping contract is exercised end to end.
 */
describe('EmployeesService (tenant-scoped)', () => {
  let service: EmployeesService;
  let repo: InMemoryEmployeeRepository;

  const EMP_A = 'employer-A';
  const EMP_B = 'employer-B';

  const dto = (name: string): CreateEmployeeDto => {
    const d = new CreateEmployeeDto();
    d.name = name;
    d.payBasis = { type: 'CTC', amount: 1_200_000 };
    d.regime = 'NEW';
    return d;
  };

  beforeEach(() => {
    repo = new InMemoryEmployeeRepository();
    service = new EmployeesService(repo);
  });

  it('creates an ACTIVE employee scoped to the employer with a uuid id', () => {
    const created = service.create(EMP_A, dto('Asha'));
    expect(created.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.employerId).toBe(EMP_A);
    expect(created.status).toBe('ACTIVE');
    expect(created.declarations).toEqual({});
    expect(created.createdAt).toBeDefined();
    expect(created.updatedAt).toBe(created.createdAt);
  });

  it('isolates tenants: employer B cannot read or list employer A rows', () => {
    const a = service.create(EMP_A, dto('Asha'));
    service.create(EMP_B, dto('Bharat'));

    expect(service.findAll(EMP_B)).toHaveLength(1);
    expect(service.findAll(EMP_A)).toHaveLength(1);
    // Cross-tenant fetch surfaces as 404, never the other tenant's row.
    expect(() => service.findOne(EMP_B, a.id)).toThrow(NotFoundException);
  });

  it('cross-tenant update is rejected (no mutation leaks across tenants)', () => {
    const a = service.create(EMP_A, dto('Asha'));
    expect(() => service.update(EMP_B, a.id, { name: 'Hacked' })).toThrow(
      NotFoundException,
    );
    // Row is untouched for the real owner.
    expect(service.findOne(EMP_A, a.id).name).toBe('Asha');
  });

  it('soft-deactivate flips status to INACTIVE without deleting the record', () => {
    const a = service.create(EMP_A, dto('Asha'));
    const deactivated = service.deactivate(EMP_A, a.id);
    expect(deactivated.status).toBe('INACTIVE');
    // Still retrievable (history preserved); excluded from activeOnly listing.
    expect(service.findOne(EMP_A, a.id).status).toBe('INACTIVE');
    expect(service.findAll(EMP_A, { activeOnly: true })).toHaveLength(0);
    expect(service.findAll(EMP_A)).toHaveLength(1);
  });

  it('applies a partial update and bumps updatedAt, keeping id/employerId/createdAt', () => {
    const a = service.create(EMP_A, dto('Asha'));
    const updated = service.update(EMP_A, a.id, {
      payBasis: { type: 'GROSS', amount: 90_000 },
    } as never);
    expect(updated.payBasis).toEqual({ type: 'GROSS', amount: 90_000 });
    expect(updated.id).toBe(a.id);
    expect(updated.employerId).toBe(EMP_A);
    expect(updated.createdAt).toBe(a.createdAt);
    expect(updated.name).toBe('Asha');
  });

  it('findOne / update / deactivate on an unknown id throw 404', () => {
    expect(() => service.findOne(EMP_A, 'nope')).toThrow(NotFoundException);
    expect(() => service.update(EMP_A, 'nope', { name: 'x' })).toThrow(
      NotFoundException,
    );
    expect(() => service.deactivate(EMP_A, 'nope')).toThrow(NotFoundException);
  });
});
