import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EMPLOYEE_REPOSITORY } from 'src/shared';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { MongoEmployeeRepository } from './mongo-employee.repository';
import { Employee, EmployeeSchema } from './schemas/employee.schema';

/**
 * EmployeesModule — the employee bounded context (FR-3, FR-4).
 *
 * Binds the Mongo-backed adapter to the EMPLOYEE_REPOSITORY token (DIP) and EXPORTS both
 * the token and EmployeesService so downstream modules (Payroll) can resolve the active
 * employee set for a run. Registers the Employee schema via MongooseModule.forFeature.
 * TenantGuard + JwtService come from the @Global SharedModule, so no re-import is needed.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Employee.name, schema: EmployeeSchema }]),
  ],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    { provide: EMPLOYEE_REPOSITORY, useClass: MongoEmployeeRepository },
  ],
  exports: [EmployeesService, EMPLOYEE_REPOSITORY],
})
export class EmployeesModule {}
