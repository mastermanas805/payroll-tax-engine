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
 * layer. Methods return Promises to satisfy the now-async EmployerRepository port
 * (the production binding is the Mongo adapter); retained as a fast test double.
 */
@Injectable()
export class InMemoryEmployerRepository implements EmployerRepository {
  private readonly byId = new Map<string, Employer>();
  private readonly idByEmail = new Map<string, string>();

  async create(employer: Employer): Promise<Employer> {
    // Defensive copy so callers cannot mutate stored state by reference.
    const stored: Employer = { ...employer };
    this.byId.set(stored.id, stored);
    this.idByEmail.set(stored.email.toLowerCase(), stored.id);
    return { ...stored };
  }

  async findById(id: string): Promise<Employer | null> {
    const found = this.byId.get(id);
    return found ? { ...found } : null;
  }

  async findByEmail(email: string): Promise<Employer | null> {
    const id = this.idByEmail.get(email.toLowerCase());
    if (!id) {
      return null;
    }
    const found = this.byId.get(id);
    return found ? { ...found } : null;
  }

  async list(): Promise<Employer[]> {
    return Array.from(this.byId.values(), (e) => ({ ...e }));
  }
}
