import { Injectable } from '@nestjs/common';
import { Employer, EmployerRepository } from 'src/shared';

/**
 * InMemoryEmployerRepository — v1 persistence adapter for the tenant root (D10).
 *
 * Implements the frozen EmployerRepository port and is bound to the
 * EMPLOYER_REPOSITORY token in IdentityModule. Other modules inject the
 * interface (never this class) via @Inject(EMPLOYER_REPOSITORY).
 *
 * Storage is a Map keyed by employer id; a secondary lowercase-email index keeps
 * findByEmail O(1) and enforces case-insensitive email uniqueness at the service
 * layer. Swapping to Postgres is a per-adapter change, not a rewrite (DIP).
 */
@Injectable()
export class InMemoryEmployerRepository implements EmployerRepository {
  private readonly byId = new Map<string, Employer>();
  private readonly idByEmail = new Map<string, string>();

  create(employer: Employer): Employer {
    // Defensive copy so callers cannot mutate stored state by reference.
    const stored: Employer = { ...employer };
    this.byId.set(stored.id, stored);
    this.idByEmail.set(stored.email.toLowerCase(), stored.id);
    return { ...stored };
  }

  findById(id: string): Employer | null {
    const found = this.byId.get(id);
    return found ? { ...found } : null;
  }

  findByEmail(email: string): Employer | null {
    const id = this.idByEmail.get(email.toLowerCase());
    if (!id) {
      return null;
    }
    const found = this.byId.get(id);
    return found ? { ...found } : null;
  }

  list(): Employer[] {
    return Array.from(this.byId.values(), (e) => ({ ...e }));
  }
}
