import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Mongoose schema for the Employer (tenant root) collection.
 *
 * The domain `id` (crypto.randomUUID) is the identity used everywhere in the app
 * and carries a unique index. Mongo keeps its own `_id`; the toDomain mapper
 * strips `_id`/`__v` so callers only ever see the Employer interface shape.
 */
export type EmployerDocument = HydratedDocument<Employer>;

@Schema({ collection: 'employers' })
export class Employer {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  companyName: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  currency: string;

  @Prop()
  state?: string;

  @Prop({ required: true })
  createdAt: string;
}

export const EmployerSchema = SchemaFactory.createForClass(Employer);
