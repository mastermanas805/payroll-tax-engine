import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentEmployer, Employee, TenantGuard } from 'src/shared';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/**
 * EmployeesController — tenant-scoped employee CRUD (FR-3, FR-4, NFR-4, NFR-7).
 *
 * Routed under the global /api/v1 prefix -> /api/v1/employees. EVERY route sits behind
 * TenantGuard (verifies the Bearer JWT and sets req.employerId) and reads the tenant via
 * @CurrentEmployer — the client-supplied body can never set or spoof employerId.
 */
@UseGuards(TenantGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /** POST /api/v1/employees — enroll a new employee under the caller's tenant. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentEmployer() employerId: string,
    @Body() dto: CreateEmployeeDto,
  ): Promise<Employee> {
    return this.employeesService.create(employerId, dto);
  }

  /**
   * GET /api/v1/employees — list this employer's employees.
   * `?activeOnly=true` restricts to ACTIVE (the set payroll runs over).
   */
  @Get()
  findAll(
    @CurrentEmployer() employerId: string,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<Employee[]> {
    return this.employeesService.findAll(employerId, {
      activeOnly: activeOnly === 'true',
    });
  }

  /** GET /api/v1/employees/:id — fetch one owned employee (404 if not found/owned). */
  @Get(':id')
  findOne(
    @CurrentEmployer() employerId: string,
    @Param('id') id: string,
  ): Promise<Employee> {
    return this.employeesService.findOne(employerId, id);
  }

  /** PATCH /api/v1/employees/:id — partial update of an owned employee. */
  @Patch(':id')
  update(
    @CurrentEmployer() employerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<Employee> {
    return this.employeesService.update(employerId, id, dto);
  }

  /** DELETE /api/v1/employees/:id — soft-deactivate (status -> INACTIVE, never hard delete). */
  @Delete(':id')
  deactivate(
    @CurrentEmployer() employerId: string,
    @Param('id') id: string,
  ): Promise<Employee> {
    return this.employeesService.deactivate(employerId, id);
  }
}
