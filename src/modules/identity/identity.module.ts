import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EMPLOYER_REPOSITORY } from 'src/shared';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongoEmployerRepository } from './mongo-employer.repository';
import { Employer, EmployerSchema } from './schemas/employer.schema';

/**
 * IdentityModule — employer (tenant) onboarding + auth (D6, D7, FR-1, FR-2, NFR-4).
 *
 * - Binds the Mongo-backed MongoEmployerRepository to the EMPLOYER_REPOSITORY
 *   token and EXPORTS it so the Employees / Payroll modules can resolve the
 *   tenant root (DIP). Registers the Employer schema via MongooseModule.forFeature.
 * - Provides AuthService + AuthController for register / login / me.
 * - JwtService and TenantGuard come from the @Global SharedModule (same JWT
 *   secret as the guard) — no re-import needed.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Employer.name, schema: EmployerSchema }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: EMPLOYER_REPOSITORY,
      useClass: MongoEmployerRepository,
    },
  ],
  exports: [EMPLOYER_REPOSITORY],
})
export class IdentityModule {}
