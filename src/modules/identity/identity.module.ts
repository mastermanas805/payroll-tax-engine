import { Module } from '@nestjs/common';

import { EMPLOYER_REPOSITORY } from 'src/shared';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InMemoryEmployerRepository } from './in-memory-employer.repository';

/**
 * IdentityModule — employer (tenant) onboarding + auth (D6, D7, FR-1, FR-2, NFR-4).
 *
 * - Binds InMemoryEmployerRepository to the EMPLOYER_REPOSITORY token and EXPORTS
 *   it so the Employees / Payroll modules can resolve the tenant root (DIP).
 * - Provides AuthService + AuthController for register / login / me.
 * - JwtService and TenantGuard come from the @Global SharedModule (same JWT
 *   secret as the guard) — no re-import needed.
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: EMPLOYER_REPOSITORY,
      useClass: InMemoryEmployerRepository,
    },
  ],
  exports: [EMPLOYER_REPOSITORY],
})
export class IdentityModule {}
