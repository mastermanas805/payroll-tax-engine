import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from './jwt-payload';

/**
 * TenantGuard — the multi-tenancy gate (NFR-4).
 *
 * Verifies the Bearer JWT with the shared JwtService (same secret as Identity,
 * provided via SharedModule), then sets `req.employerId` and `req.role`. On any
 * missing/invalid token it throws UnauthorizedException (401). Controllers read
 * the tenant via the @CurrentEmployer() decorator — never from the request body.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { employerId?: string; role?: string; user?: JwtPayload }>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (!payload?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }
      req.employerId = payload.sub;
      req.role = payload.role;
      req.user = payload;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(req: Request): string | undefined {
    const header = req.headers?.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? value : undefined;
  }
}
