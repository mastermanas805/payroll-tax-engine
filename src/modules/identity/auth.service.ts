import { randomUUID } from 'crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import {
  EMPLOYER_REPOSITORY,
  Employer,
  EmployerRepository,
  JwtPayload,
} from 'src/shared';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { currencyForCountry } from './country-currency';
import { AuthResult, EmployerView, toEmployerView } from './auth.types';

/**
 * AuthService — employer (tenant) onboarding + authentication (FR-1, D6, D7, NFR-4).
 *
 * register: validate uniqueness, hash the password with bcryptjs, create the
 *   Employer with country + derived currency, and sign a JWT carrying the
 *   employerId (sub) + role.
 * login: verify the password against the stored hash, then sign a JWT.
 * getMe: return the public employer for the current tenant.
 *
 * The JWT is signed by the @Global SharedModule's JwtService, so it shares the
 * SAME secret the TenantGuard verifies against — no secret duplication.
 */
@Injectable()
export class AuthService {
  /** bcrypt work factor — a sensible default for an interactive login path. */
  private static readonly SALT_ROUNDS = 10;
  /** Default tenant role; ruleset publishing requires the elevated `rule_admin`. */
  private static readonly DEFAULT_ROLE = 'employer_admin';

  constructor(
    @Inject(EMPLOYER_REPOSITORY)
    private readonly employers: EmployerRepository,
    private readonly jwtService: JwtService,
  ) {}

  /** Register a new employer tenant (FR-1). Email is unique (case-insensitive). */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();

    if (this.employers.findByEmail(email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const country = dto.country.trim().toUpperCase();
    const currency = currencyForCountry(country);
    if (!currency) {
      // Belt-and-suspenders: the DTO @IsIn already constrains country, but the
      // currency map is the single source of truth, so we re-check it here.
      throw new ConflictException(`Unsupported country: ${country}`);
    }

    const passwordHash = await bcrypt.hash(dto.password, AuthService.SALT_ROUNDS);
    const now = new Date().toISOString();

    const employer: Employer = {
      id: randomUUID(),
      companyName: dto.companyName.trim(),
      email,
      passwordHash,
      country,
      currency,
      state: dto.state?.trim() || 'KA',
      createdAt: now,
    };

    const created = this.employers.create(employer);
    return this.buildAuthResult(created);
  }

  /** Authenticate an existing employer (FR-1). */
  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const employer = this.employers.findByEmail(email);

    // Always run a compare to keep timing roughly uniform whether or not the
    // account exists; never reveal which of email/password was wrong.
    const hash = employer?.passwordHash ?? '';
    const passwordOk = await bcrypt.compare(dto.password, hash);

    if (!employer || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResult(employer);
  }

  /** Return the current tenant's public profile (GET /me, FR-1). */
  getMe(employerId: string): EmployerView {
    const employer = this.employers.findById(employerId);
    if (!employer) {
      // Token is valid but the tenant no longer exists.
      throw new UnauthorizedException('Account not found');
    }
    return toEmployerView(employer);
  }

  /** Sign the tenant JWT (sub = employerId, + email + role) and project the view. */
  private buildAuthResult(employer: Employer): AuthResult {
    const payload: JwtPayload = {
      sub: employer.id,
      email: employer.email,
      role: AuthService.DEFAULT_ROLE,
    };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, employer: toEmployerView(employer) };
  }
}
