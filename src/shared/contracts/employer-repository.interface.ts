import { Employer } from '../types/domain.types';

/**
 * EmployerRepository — persistence port for the tenant root (DIP, D10).
 * Bind a concrete impl to the EMPLOYER_REPOSITORY token.
 */
export interface EmployerRepository {
  /** Persist a new employer. */
  create(employer: Employer): Employer;

  /** Fetch by id, or null. */
  findById(id: string): Employer | null;

  /** Fetch by login email (auth), or null. */
  findByEmail(email: string): Employer | null;

  /** All employers (admin / internal). */
  list(): Employer[];
}
