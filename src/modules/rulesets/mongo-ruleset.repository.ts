import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  InvalidRuleSetException,
  RuleSet,
  RulesetRepository,
} from 'src/shared';

import { validateRuleSet } from './ruleset-validator';
import {
  RuleSet as RuleSetSchemaClass,
  RuleSetDocument,
} from './schemas/ruleset.schema';
import inOld202526 from './data/in-old-2025-26.json';
import inNew202526 from './data/in-new-2025-26.json';

/** The rulesets seeded on first boot (§7: seeded by platform ops). */
const SEED_RULESETS = [inOld202526, inNew202526] as unknown as RuleSet[];

/**
 * Mongoose-backed RulesetRepository (replaces the in-memory one). Rulesets are
 * platform-global, not tenant-scoped. On module init, if the collection is empty
 * it validates + persists the two seed JSON files (the JSON stays the seed source).
 *
 * resolve() does the date-window comparison IN JS (YYYY-MM / YYYY-MM-DD -> a
 * comparable yyyymm number) rather than relying on Mongo's lexicographic string
 * comparison, which breaks at the YYYY-MM vs YYYY-MM-DD boundary.
 */
@Injectable()
export class MongoRulesetRepository implements RulesetRepository, OnModuleInit {
  private readonly logger = new Logger(MongoRulesetRepository.name);

  constructor(
    @InjectModel(RuleSetSchemaClass.name)
    private readonly model: Model<RuleSetDocument>,
  ) {}

  /** Seed the JSON rulesets on first boot if the collection is empty. */
  async onModuleInit(): Promise<void> {
    const count = await this.model.estimatedDocumentCount().exec();
    if (count > 0) {
      return;
    }
    for (const rs of SEED_RULESETS) {
      // Seeds must be valid; a broken seed is a programming error — save() throws.
      await this.save(rs);
    }
    this.logger.log(`Seeded ${SEED_RULESETS.length} rulesets into MongoDB`);
  }

  /**
   * Resolve the PUBLISHED ruleset effective for (country, regime) at `period`.
   * Fetches the PUBLISHED candidates from Mongo, then applies the date-window
   * logic in JS (yyyymm comparison; effectiveTo null = open-ended), returning the
   * highest version. Returns null if none is effective.
   */
  async resolve(
    country: string,
    regime: string,
    period: string,
  ): Promise<RuleSet | null> {
    const periodKey = this.toYyyymm(period);

    const candidates = await this.model
      .find({ country, regime, status: 'PUBLISHED' })
      .lean()
      .exec();

    const matches = candidates
      .map((d) => this.toDomain(d))
      .filter((rs) => {
        const from = this.toYyyymm(rs.effectiveFrom);
        const to = rs.effectiveTo ? this.toYyyymm(rs.effectiveTo) : null;
        return periodKey >= from && (to === null || periodKey <= to);
      });

    if (matches.length === 0) {
      return null;
    }
    // Prefer the highest version if multiple windows overlap.
    matches.sort((a, b) => b.version - a.version);
    return matches[0];
  }

  async findById(id: string): Promise<RuleSet | null> {
    const doc = await this.model.findOne({ id }).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async list(): Promise<RuleSet[]> {
    const docs = await this.model.find().lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  /**
   * Upsert a ruleset after publish-time validation (D2). Throws
   * InvalidRuleSetException if the ruleset fails validation.
   */
  async save(rs: RuleSet): Promise<void> {
    const issues = validateRuleSet(rs);
    if (issues.length > 0) {
      throw new InvalidRuleSetException(
        `Ruleset ${rs.id} failed validation`,
        issues,
      );
    }
    await this.model
      .updateOne({ id: rs.id }, { $set: { ...rs } }, { upsert: true })
      .exec();
  }

  /**
   * Normalize a period / effective date to a comparable yyyymm number.
   * Accepts "YYYY-MM" or "YYYY-MM-DD"; the day component is ignored because the
   * pay cycle is monthly (§7) and windows are month-granular. Doing this in JS
   * (not Mongo) avoids the lexicographic YYYY-MM vs YYYY-MM-DD comparison bug.
   */
  private toYyyymm(value: string): number {
    const [y, m] = value.split('-');
    return Number(y) * 100 + Number(m);
  }

  /** Map a lean Mongo doc to the exact RuleSet domain shape (no _id/__v). */
  private toDomain(doc: Record<string, any>): RuleSet {
    return {
      id: doc.id,
      country: doc.country,
      regime: doc.regime,
      financialYear: doc.financialYear,
      effectiveFrom: doc.effectiveFrom,
      effectiveTo: doc.effectiveTo ?? null,
      version: doc.version,
      status: doc.status,
      currency: doc.currency,
      rounding: doc.rounding,
      rules: doc.rules,
    };
  }
}
