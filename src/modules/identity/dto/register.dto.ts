import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SUPPORTED_COUNTRIES } from '../country-currency';

/**
 * Registration payload (FR-1). Currency is NOT accepted from the client — it is
 * derived from `country` (single currency per country, §7). The ValidationPipe in
 * main.ts is `{ whitelist: true }`, so any stray `currency`/`role` fields are
 * stripped, not trusted.
 */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Plaintext on the wire (TLS in transit, NFR-4); hashed with bcrypt at rest. */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** ISO-3166 alpha-2; must be a country we ship a ruleset for (v1: IN). */
  @IsString()
  @IsIn(SUPPORTED_COUNTRIES)
  country!: string;

  /** PT/state schedule selector (default KA — Karnataka, §7). */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  state?: string;
}
