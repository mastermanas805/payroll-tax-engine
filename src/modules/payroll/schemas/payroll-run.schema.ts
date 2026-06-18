import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Mongoose schema for the payroll_run collection (tenant-scoped via employerId).
 *
 * failedEmployeeIds is stored as a plain string array. Indexes: unique on domain
 * `id`, (employerId) for run listing, and (employerId, period) to back the
 * idempotency lookup (one run per period per tenant).
 */
export type PayrollRunDocument = HydratedDocument<PayrollRun>;

@Schema({ collection: 'payroll_run' })
export class PayrollRun {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  employerId: string;

  @Prop({ required: true })
  period: string;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true, default: 0 })
  payslipCount: number;

  @Prop({ type: [String], default: undefined })
  failedEmployeeIds?: string[];

  @Prop({ required: true })
  createdAt: string;
}

export const PayrollRunSchema = SchemaFactory.createForClass(PayrollRun);

// (employerId, period) — idempotency lookup for "a run already exists this period".
PayrollRunSchema.index({ employerId: 1, period: 1 });
