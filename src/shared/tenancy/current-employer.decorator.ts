import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentEmployer() — injects the tenant id (req.employerId) set by TenantGuard.
 * Controllers MUST source employerId from here, never from the client body (NFR-4).
 *
 *   @Get() list(@CurrentEmployer() employerId: string) { ... }
 */
export const CurrentEmployer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ employerId: string }>();
    return req.employerId;
  },
);

/**
 * @CurrentRole() — injects the RBAC role (req.role) set by TenantGuard.
 * Used to gate elevated actions like ruleset publishing (NFR-4).
 */
export const CurrentRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ role: string }>();
    return req.role;
  },
);
