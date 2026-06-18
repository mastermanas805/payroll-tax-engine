import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

/**
 * Mongoose schema for the payslip collection (append-only, immutable; NFR-2).
 *
 * The full reconciled CalculationResult is stored as Mixed — numbers pass through
 * unchanged, preserving paisa-level precision. Indexes: unique on domain `id`,
 * (employerId) for tenant reads, (runId) for per-run listing, and a UNIQUE
 * (runId, employeeId) to enforce exactly-one payslip per (run, employee) (NFR-6).
 */
export type PayslipDocument = HydratedDocument<Payslip>;

@Schema({ collection: 'payslips' })
export class Payslip {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true, index: true })
  employerId: string;

  @Prop({ required: true, index: true })
  runId: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop({ required: true })
  period: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  result: unknown;

  @Prop({ required: true })
  createdAt: string;
}

export const PayslipSchema = SchemaFactory.createForClass(Payslip);

// Exactly-once per (run, employee) — the idempotency / no-double-pay guarantee.
PayslipSchema.index({ runId: 1, employeeId: 1 }, { unique: true });
