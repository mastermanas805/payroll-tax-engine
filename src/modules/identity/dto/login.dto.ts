import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Login payload (FR-1). Verified against the stored bcrypt hash. */
export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
