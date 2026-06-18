import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Employee,
  EmployeeRepository,
  FindEmployeesOptions,
} from 'src/shared';

import {
  Employee as EmployeeSchemaClass,
  EmployeeDocument,
} from './schemas/employee.schema';

/**
 * MongoEmployeeRepository — Mongoose-backed, tenant-scoped adapter (replaces
 * InMemoryEmployeeRepository). EVERY query is scoped by `employerId` (sourced
 * from the JWT via @CurrentEmployer), so an employer can never read or mutate
 * another tenant's row — cross-tenant lookups return null / an empty list.
 *
 * Reads use `.lean()`; toDomain() returns EXACTLY the Employee interface shape.
 * Identity / ownership fields (id, employerId, createdAt) are never patched.
 */
@Injectable()
export class MongoEmployeeRepository implements EmployeeRepository {
  constructor(
    @InjectModel(EmployeeSchemaClass.name)
    private readonly model: Model<EmployeeDocument>,
  ) {}

  async create(employee: Employee): Promise<Employee> {
    const created = await this.model.create({ ...employee });
    return this.toDomain(created.toObject());
  }

  async findByEmployer(
    employerId: string,
    opts?: FindEmployeesOptions,
  ): Promise<Employee[]> {
    const filter: Record<string, unknown> = { employerId };
    if (opts?.activeOnly === true) {
      filter.status = 'ACTIVE';
    }
    const docs = await this.model.find(filter).lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  async findOne(employerId: string, id: string): Promise<Employee | null> {
    const doc = await this.model.findOne({ id, employerId }).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async update(
    employerId: string,
    id: string,
    patch: Partial<Employee>,
  ): Promise<Employee | null> {
    // Identity & ownership fields are immutable — never overwritten from a patch.
    const { id: _i, employerId: _e, createdAt: _c, ...rest } = patch;
    const $set: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date().toISOString(),
    };
    const doc = await this.model
      .findOneAndUpdate({ id, employerId }, { $set }, { new: true })
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  /** Map a lean Mongo doc to the exact Employee domain shape (no _id/__v). */
  private toDomain(doc: Record<string, any>): Employee {
    return {
      id: doc.id,
      employerId: doc.employerId,
      name: doc.name,
      payBasis: doc.payBasis,
      regime: doc.regime,
      declarations: doc.declarations ?? {},
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
