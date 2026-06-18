import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentEmployer, TenantGuard } from 'src/shared';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResult, EmployerView } from './auth.types';

/**
 * AuthController — tenant onboarding + auth surface (FR-1).
 *
 * Routes (global prefix `/api/v1` is set in main.ts):
 *   POST /api/v1/auth/register   public
 *   POST /api/v1/auth/login      public
 *   GET  /api/v1/me              behind TenantGuard; reads tenant via @CurrentEmployer
 *
 * /me lives at the API root (not under /auth) so it reads as the canonical
 * "current tenant" endpoint. employerId is always sourced from the verified JWT,
 * never from the client (NFR-4).
 */
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(TenantGuard)
  getMe(@CurrentEmployer() employerId: string): EmployerView {
    return this.authService.getMe(employerId);
  }
}
