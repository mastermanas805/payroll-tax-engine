import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Employer, EmployerRepository } from 'src/shared';

import {
  Employer as EmployerSchemaClass,
  EmployerDocument,
} from './schemas/employer.schema';

/**
 * MongoEmployerRepository — Mongoose-backed persistence adapter for the tenant
 * root (replaces InMemoryEmployerRepository). Bound to the EMPLOYER_REPOSITORY
 * token in IdentityModule; other modules inject the interface, never this class.
 *
 * Reads use `.lean()` and `toDomain()` returns EXACTLY the Employer interface
 * shape (Mongo's `_id`/`__v` are stripped). The domain `id` (a uuid) is the
 * identity carried everywhere; email uniqueness is enforced by a unique index.
 */
@Injectable()
export class MongoEmployerRepository implements EmployerRepository {
  constructor(
    @InjectModel(EmployerSchemaClass.name)
    private readonly model: Model<EmployerDocument>,
  ) {}

  async create(employer: Employer): Promise<Employer> {
    const created = await this.model.create({ ...employer });
    return this.toDomain(created.toObject());
  }

  async findById(id: string): Promise<Employer | null> {
    const doc = await this.model.findOne({ id }).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<Employer | null> {
    const doc = await this.model
      .findOne({ email: email.toLowerCase() })
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async list(): Promise<Employer[]> {
    const docs = await this.model.find().lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  /** Map a lean Mongo doc to the exact Employer domain shape (no _id/__v). */
  private toDomain(doc: Record<string, any>): Employer {
    return {
      id: doc.id,
      companyName: doc.companyName,
      email: doc.email,
      passwordHash: doc.passwordHash,
      country: doc.country,
      currency: doc.currency,
      state: doc.state,
      createdAt: doc.createdAt,
    };
  }
}
