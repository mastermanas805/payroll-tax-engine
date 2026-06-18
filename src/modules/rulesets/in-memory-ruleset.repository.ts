import { Injectable } from '@nestjs/common';
import { InvalidRuleSetException, RuleSet, RulesetRepository } from 'src/shared';
import { validateRuleSet } from './ruleset-validator';
import inOld202526 from './data/in-old-2025-26.json';
import inNew202526 from './data/in-new-2025-26.json';

/** The rulesets seeded at construction (§7: seeded by platform ops). */
const SEED_RULESETS = [inOld202526, inNew202526] as unknown as RuleSet[];

/**
 * In-memory RulesetRepository (D10). Rulesets are platform-global, not
 * tenant-scoped. Loads + validates the seed rulesets at construction and
 * supports temporal resolution by (country, regime, period).
 */
@Injectable()
export class InMemoryRulesetRepository implements RulesetRepository {
  private readonly store = new Map<string, RuleSet>();

  constructor() {
    for (const rs of SEED_RULESETS) {
      // Seeds must be valid; a broken seed is a programming error, fail loud.
      this.save(rs);
    }
  }

  /**
   * Resolve the PUBLISHED ruleset effective for (country, regime) at `period`.
   * @param period YYYY-MM (or any ISO date prefix); compared against the
   *   [effectiveFrom, effectiveTo] window. Returns the highest-version match.
   */
  resolve(country: string, regime: string, period: string): RuleSet | null {
    const periodKey = this.toDate(period);

    const matches = this.list().filter((rs) => {
      if (rs.status !== 'PUBLISHED') return false;
      if (rs.country !== country || rs.regime !== regime) return false;
      const from = this.toDate(rs.effectiveFrom);
      const to = rs.effectiveTo ? this.toDate(rs.effectiveTo) : null;
      return periodKey >= from && (to === null || periodKey <= to);
    });

    if (matches.length === 0) return null;
    // Prefer the highest version if multiple windows overlap.
    matches.sort((a, b) => b.version - a.version);
    return matches[0];
  }

  findById(id: string): RuleSet | null {
    return this.store.get(id) ?? null;
  }

  list(): RuleSet[] {
    return [...this.store.values()];
  }

  /**
   * Upsert a ruleset after publish-time validation (D2). Throws
   * InvalidRuleSetException if the ruleset fails validation.
   */
  save(rs: RuleSet): void {
    const issues = validateRuleSet(rs);
    if (issues.length > 0) {
      throw new InvalidRuleSetException(`Ruleset ${rs.id} failed validation`, issues);
    }
    this.store.set(rs.id, rs);
  }

  /**
   * Normalize a period / effective date to a comparable yyyymm number.
   * Accepts "YYYY-MM" or "YYYY-MM-DD"; the day component is ignored because
   * the pay cycle is monthly (§7) and windows are month-granular here.
   */
  private toDate(value: string): number {
    const [y, m] = value.split('-');
    return Number(y) * 100 + Number(m);
  }
}
