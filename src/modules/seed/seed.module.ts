import { Module } from '@nestjs/common';

import { IdentityModule } from 'src/modules/identity/identity.module';
import { EmployeesModule } from 'src/modules/employees/employees.module';

import { SeedService } from './seed.service';

/**
 * SeedModule — Integration-owned startup seeding. Imports the modules that
 * export EMPLOYER_REPOSITORY and EMPLOYEE_REPOSITORY so the SeedService can
 * populate a demo tenant on bootstrap. Rulesets self-seed in their own repo.
 */
@Module({
  imports: [IdentityModule, EmployeesModule],
  providers: [SeedService],
})
export class SeedModule {}
