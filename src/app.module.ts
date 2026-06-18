import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
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
 * - ConfigModule.forRoot({ isGlobal: true }) — env (MONGO_URI, JWT_SECRET, PORT, ...).
 * - MongooseModule.forRootAsync — real persistence; connection string from
 *   ConfigService/process.env MONGO_URI, defaulting to localhost/payroll.
 * - SharedModule (@Global) — JWT + TenantGuard kernel.
 * - ServeStaticModule — serves the built SPA from client/dist at '/', excluding /api/*.
 * - Feature modules (Identity, Employees, Rulesets, TaxEngine, Payroll).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri:
          config.get<string>('MONGO_URI') ??
          'mongodb://localhost:27017/payroll',
      }),
    }),
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
