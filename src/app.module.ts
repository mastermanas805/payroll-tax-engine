import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';

import { SharedModule } from './shared/shared.module';

// Feature modules — each owned by a downstream agent. Imported here by their
// expected paths so the Integration agent's wiring is already in place. The
// Foundation agent does NOT build (these are written by other agents).
import { IdentityModule } from './modules/identity/identity.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { RulesetsModule } from './modules/rulesets/rulesets.module';
import { TaxEngineModule } from './modules/tax-engine/tax-engine.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { SeedModule } from './modules/seed/seed.module';

/**
 * Root composition module.
 *
 * - ConfigModule.forRoot({ isGlobal: true }) — env (JWT_SECRET, PORT, ...).
 * - SharedModule (@Global) — JWT + TenantGuard kernel.
 * - ServeStaticModule — serves the built SPA from client/dist at '/', excluding /api/*.
 * - Feature modules (Identity, Employees, Rulesets, TaxEngine, Payroll).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client', 'dist'),
      exclude: ['/api/(.*)'],
    }),
    IdentityModule,
    EmployeesModule,
    RulesetsModule,
    TaxEngineModule,
    PayrollModule,
    SeedModule,
  ],
})
export class AppModule {}
