import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantGuard } from './tenancy/tenant.guard';

/**
 * SharedModule — the @Global() kernel module.
 *
 * Registers ONE JwtModule (secret = process.env.JWT_SECRET || 'dev-secret',
 * 12h expiry) so Identity signs and every controller's TenantGuard verifies with
 * the SAME secret. Provides + exports TenantGuard and re-exports JwtModule so
 * feature modules can inject JwtService (Identity) and use TenantGuard without
 * re-importing anything (it is @Global).
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  providers: [TenantGuard],
  exports: [JwtModule, TenantGuard],
})
export class SharedModule {}
