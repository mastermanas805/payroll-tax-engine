import { randomUUID } from 'crypto';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import {
  EMPLOYEE_REPOSITORY,
  EMPLOYER_REPOSITORY,
  Employee,
  EmployeeRepository,
  Employer,
  EmployerRepository,
} from 'src/shared';

/**
 * Demo seed (Integration wiring). On application bootstrap it loads a demo
 * employer plus a few employees so the SPA has data to render immediately.
 * Rulesets self-seed in the RulesetsModule repository, so they are not seeded
 * here. Idempotent: it skips if the demo employer already exists.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  /** Demo login: hr@acme.in / password */
  static readonly DEMO_EMAIL = 'hr@acme.in';
  static readonly DEMO_PASSWORD = 'password';

  constructor(
    @Inject(EMPLOYER_REPOSITORY)
    private readonly employers: EmployerRepository,
    @Inject(EMPLOYEE_REPOSITORY)
    private readonly employees: EmployeeRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.employers.findByEmail(SeedService.DEMO_EMAIL)) {
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(SeedService.DEMO_PASSWORD, 10);

    const employer: Employer = {
      id: randomUUID(),
      companyName: 'Acme India Pvt Ltd',
      email: SeedService.DEMO_EMAIL,
      passwordHash,
      country: 'IN',
      currency: 'INR',
      state: 'KA',
      createdAt: now,
    };
    this.employers.create(employer);

    const roster: Array<Pick<Employee, 'name' | 'payBasis' | 'regime' | 'declarations'>> = [
      {
        name: 'Priya Sharma',
        payBasis: { type: 'CTC', amount: 1800000 },
        regime: 'NEW',
        declarations: {},
      },
      {
        name: 'Rahul Verma',
        payBasis: { type: 'CTC', amount: 1200000 },
        regime: 'OLD',
        declarations: { rentPaid: 240000, section80C: 150000, metro: true },
      },
      {
        name: 'Anita Desai',
        payBasis: { type: 'CTC', amount: 600000 },
        regime: 'NEW',
        declarations: {},
      },
    ];

    for (const r of roster) {
      const employee: Employee = {
        id: randomUUID(),
        employerId: employer.id,
        name: r.name,
        payBasis: r.payBasis,
        regime: r.regime,
        declarations: r.declarations,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      this.employees.create(employee);
    }

    this.logger.log(
      `Seeded demo employer ${SeedService.DEMO_EMAIL} (${employer.id}) with ${roster.length} employees`,
    );
  }
}
