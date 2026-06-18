import { Module } from '@nestjs/common';

import { PAYROLL_RUN_REPOSITORY, PAYSLIP_REPOSITORY } from 'src/shared/contracts';

// Sibling feature modules — imported so this module can inject the tokens they
// export (TAX_ENGINE, RULESET_REPOSITORY, EMPLOYEE_REPOSITORY). We depend on the
// interfaces behind those tokens, never the concrete classes (DIP, NFR-9).
import { EmployeesModule } from 'src/modules/employees/employees.module';
import { RulesetsModule } from 'src/modules/rulesets/rulesets.module';
import { TaxEngineModule } from 'src/modules/tax-engine/tax-engine.module';

import { PayrollService } from './payroll.service';
import { PayrollController, PayslipController } from './payroll.controller';
import { InMemoryPayrollRunRepository } from './repositories/in-memory-payroll-run.repository';
import { InMemoryPayslipRepository } from './repositories/in-memory-payslip.repository';

/**
 * PayrollModule — owns payroll orchestration: runs + payslips (FR-5..FR-11).
 *
 * Binds the in-memory PayrollRun / Payslip repositories to their frozen tokens
 * and EXPORTS them so other contexts (e.g. reporting) can read them. The tax
 * engine, rulesets and employees are consumed via the tokens exported by their
 * own modules — this module never references their concrete classes.
 */
@Module({
  imports: [TaxEngineModule, RulesetsModule, EmployeesModule],
  controllers: [PayrollController, PayslipController],
  providers: [
    PayrollService,
    { provide: PAYROLL_RUN_REPOSITORY, useClass: InMemoryPayrollRunRepository },
    { provide: PAYSLIP_REPOSITORY, useClass: InMemoryPayslipRepository },
  ],
  exports: [PAYROLL_RUN_REPOSITORY, PAYSLIP_REPOSITORY],
})
export class PayrollModule {}
