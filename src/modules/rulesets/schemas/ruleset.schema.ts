import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

/**
 * Mongoose schema for the ruleset collection (platform-global, not tenant-scoped).
 *
 * rounding (RoundingConfig) and rules (the full Rule[] tree) are stored as Mixed
 * so the data-driven ruleset is persisted verbatim — no over-modeling of the
 * declarative rule shapes. Indexes: unique on domain `id`, and
 * (country, regime, status) to serve resolve() candidate lookups.
 */
export type RuleSetDocument = HydratedDocument<RuleSet>;

@Schema({ collection: 'rulesets' })
export class RuleSet {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  regime: string;

  @Prop({ required: true })
  financialYear: string;

  @Prop({ required: true })
  effectiveFrom: string;

  @Prop({ type: String, default: null })
  effectiveTo?: string | null;

  @Prop({ required: true })
  version: number;

  @Prop({ required: true })
  status: string;

  @Prop({ required: true })
  currency: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  rounding: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  rules: unknown;
}

export const RuleSetSchema = SchemaFactory.createForClass(RuleSet);

// (country, regime, status) — candidate lookup for temporal resolution.
RuleSetSchema.index({ country: 1, regime: 1, status: 1 });
