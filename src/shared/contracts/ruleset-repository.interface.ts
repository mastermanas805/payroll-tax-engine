import { RuleSet } from '../types/ruleset.types';

/**
 * RulesetRepository — persistence port for rulesets (DIP, D10).
 * Rulesets are platform-global (not tenant-scoped); seeded by ops (§7).
 * Bind a concrete impl to the RULESET_REPOSITORY token.
 */
export interface RulesetRepository {
  /**
   * Resolve the PUBLISHED ruleset effective for (country, regime) at `period`.
   * @param period YYYY-MM; the ruleset whose [effectiveFrom, effectiveTo] covers it.
   * @returns the matching RuleSet, or null if none is effective.
   */
  resolve(country: string, regime: string, period: string): Promise<RuleSet | null>;

  /** Fetch a ruleset by its id (e.g. "IN-OLD-2025-26"), or null. */
  findById(id: string): Promise<RuleSet | null>;

  /** List all known rulesets. */
  list(): Promise<RuleSet[]>;

  /** Upsert a ruleset (seed / publish). */
  save(rs: RuleSet): Promise<void>;
}
