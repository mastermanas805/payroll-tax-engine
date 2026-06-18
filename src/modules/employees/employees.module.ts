import { Module } from '@nestjs/common';
import { EMPLOYEE_REPOSITORY } from 'src/shared';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { InMemoryEmployeeRepository } from './employee.repository';

/**
 * EmployeesModule — the employee bounded context (FR-3, FR-4).
 *
 * Binds the in-memory adapter to the EMPLOYEE_REPOSITORY token (DIP) and EXPORTS both
 * the token and EmployeesService so downstream modules (Payroll) can resolve the active
 * employee set for a run. TenantGuard + JwtService come from the @Global SharedModule,
 * so no re-import is needed here.
 */
@Module({
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    { provide: EMPLOYEE_REPOSITORY, useClass: InMemoryEmployeeRepository },
  ],
  exports: [EmployeesService, EMPLOYEE_REPOSITORY],
})
export class EmployeesModule {}
