import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PayrollRun } from 'src/shared/types/domain.types';
import { PayrollRunRepository } from 'src/shared/contracts';

import {
  PayrollRun as PayrollRunSchemaClass,
  PayrollRunDocument,
} from '../schemas/payroll-run.schema';

/**
 * Mongoose-backed PayrollRunRepository (replaces the in-memory one). Tenant-scoped:
 * every read takes the employerId from @CurrentEmployer / the JWT and a run is only
 * ever returned to the employer that owns it (NFR-4). Bound to PAYROLL_RUN_REPOSITORY
 * and exported from PayrollModule. Reads use `.lean()` + a toDomain mapper.
 */
@Injectable()
export class MongoPayrollRunRepository implements PayrollRunRepository {
  constructor(
    @InjectModel(PayrollRunSchemaClass.name)
    private readonly model: Model<PayrollRunDocument>,
  ) {}

  async create(run: PayrollRun): Promise<PayrollRun> {
    const created = await this.model.create({ ...run });
    return this.toDomain(created.toObject());
  }

  async findByEmployer(employerId: string): Promise<PayrollRun[]> {
    const docs = await this.model
      .find({ employerId })
      .sort({ createdAt: -1 }) // newest first
      .lean()
      .exec();
    return docs.map((d) => this.toDomain(d));
  }

  async findOne(employerId: string, id: string): Promise<PayrollRun | null> {
    const doc = await this.model.findOne({ id, employerId }).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByPeriod(
    employerId: string,
    period: string,
  ): Promise<PayrollRun | null> {
    const doc = await this.model.findOne({ employerId, period }).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async update(
    employerId: string,
    id: string,
    patch: Partial<PayrollRun>,
  ): Promise<PayrollRun | null> {
    // employerId / id are identity and never patched.
    const { id: _i, employerId: _e, ...rest } = patch;
    const doc = await this.model
      .findOneAndUpdate({ id, employerId }, { $set: rest }, { new: true })
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  /** Map a lean Mongo doc to the exact PayrollRun domain shape (no _id/__v). */
  private toDomain(doc: Record<string, any>): PayrollRun {
    return {
      id: doc.id,
      employerId: doc.employerId,
      period: doc.period,
      status: doc.status,
      payslipCount: doc.payslipCount,
      failedEmployeeIds: doc.failedEmployeeIds ?? undefined,
      createdAt: doc.createdAt,
    };
  }
}
