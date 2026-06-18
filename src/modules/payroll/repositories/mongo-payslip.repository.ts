import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Payslip } from 'src/shared/types/domain.types';
import { PayslipRepository } from 'src/shared/contracts';

import {
  Payslip as PayslipSchemaClass,
  PayslipDocument,
} from '../schemas/payslip.schema';

/**
 * Mongoose-backed PayslipRepository (replaces the in-memory one). Append-only /
 * immutable (NFR-2). Tenant-scoped (NFR-4) and enforces exactly-one payslip per
 * (runId, employeeId) via a UNIQUE index (FR-10, NFR-6) so retries never
 * double-pay — a duplicate insert is caught and the existing payslip returned
 * (idempotent). Bound to PAYSLIP_REPOSITORY and exported from PayrollModule.
 */
@Injectable()
export class MongoPayslipRepository implements PayslipRepository {
  constructor(
    @InjectModel(PayslipSchemaClass.name)
    private readonly model: Model<PayslipDocument>,
  ) {}

  async create(payslip: Payslip): Promise<Payslip> {
    try {
      const created = await this.model.create({ ...payslip });
      return this.toDomain(created.toObject());
    } catch (err: any) {
      // Idempotent: a payslip for this (run, employee) already exists (unique
      // index violation, code 11000) — return it rather than emitting a duplicate.
      if (err?.code === 11000) {
        const existing = await this.findByRunAndEmployee(
          payslip.employerId,
          payslip.runId,
          payslip.employeeId,
        );
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  async findOne(employerId: string, id: string): Promise<Payslip | null> {
    const doc = await this.model.findOne({ id, employerId }).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByRun(employerId: string, runId: string): Promise<Payslip[]> {
    const docs = await this.model.find({ employerId, runId }).lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  async findByRunAndEmployee(
    employerId: string,
    runId: string,
    employeeId: string,
  ): Promise<Payslip | null> {
    const doc = await this.model
      .findOne({ employerId, runId, employeeId })
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByEmployee(
    employerId: string,
    employeeId: string,
  ): Promise<Payslip[]> {
    const docs = await this.model.find({ employerId, employeeId }).lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  /** Map a lean Mongo doc to the exact Payslip domain shape (no _id/__v). */
  private toDomain(doc: Record<string, any>): Payslip {
    return {
      id: doc.id,
      employerId: doc.employerId,
      runId: doc.runId,
      employeeId: doc.employeeId,
      period: doc.period,
      result: doc.result,
      createdAt: doc.createdAt,
    };
  }
}
