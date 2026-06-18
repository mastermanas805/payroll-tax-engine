import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

/**
 * Mongoose schema for the Employee collection (tenant-scoped via employerId).
 *
 * payBasis + declarations are stored as Mixed to avoid over-modeling the nested
 * objects; numbers pass through unchanged (no reformatting — money precision is
 * preserved). Indexes: unique on domain `id`, and (employerId, status) to serve
 * tenant-scoped active-only roster reads for payroll runs.
 */
export type EmployeeDocument = HydratedDocument<Employee>;

@Schema({ collection: 'employees' })
export class Employee {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  employerId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payBasis: unknown;

  @Prop({ required: true })
  regime: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  declarations: unknown;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  createdAt: string;

  @Prop({ required: true })
  updatedAt: string;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);

// (employerId, status) compound index for tenant-scoped active-only listing.
EmployeeSchema.index({ employerId: 1, status: 1 });
