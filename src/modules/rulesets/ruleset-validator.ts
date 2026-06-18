import { Rule, RuleSet, RuleType, SlabBracket } from 'src/shared';

/**
 * One validation problem found in a ruleset (publish-time gate — D2).
 */
export interface ValidationIssue {
  /** machine-readable category of the problem. */
  code:
    | 'RATE_OUT_OF_RANGE'
    | 'SLAB_GAP'
    | 'SLAB_OVERLAP'
    | 'SLAB_EMPTY'
    | 'SLAB_BAD_BOUNDS'
    | 'DAG_CYCLE'
    | 'UNSATISFIED_READ'
    | 'DUPLICATE_WRITE'
    | 'MISSING_WRITE';
  /** rule key the issue relates to (or '*' for ruleset-level). */
  ruleKey: string;
  /** human-readable explanation. */
  message: string;
}

/** Context keys treated as engine-provided inputs (no rule needs to write them). */
const EXTERNAL_READ_PREFIXES = ['input:', 'declarations.', 'context.'];

function isExternalRead(key: string): boolean {
  return EXTERNAL_READ_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * Validate every rate-bearing param of a rule sits within [0, 1].
 * Covers PERCENTAGE_OF.rate and SLAB bracket rates.
 */
function checkRates(rule: Rule, issues: ValidationIssue[]): void {
  const inRange = (n: unknown): boolean => typeof n === 'number' && n >= 0 && n <= 1;

  if (rule.type === RuleType.PERCENTAGE_OF) {
    if (!inRange(rule.params?.rate)) {
      issues.push({
        code: 'RATE_OUT_OF_RANGE',
        ruleKey: rule.key,
        message: `PERCENTAGE_OF rate ${rule.params?.rate} must be within [0, 1]`,
      });
    }
  }

  if (rule.type === RuleType.SLAB) {
    const brackets: SlabBracket[] = rule.params?.brackets ?? [];
    for (const b of brackets) {
      if (!inRange(b.rate)) {
        issues.push({
          code: 'RATE_OUT_OF_RANGE',
          ruleKey: rule.key,
          message: `SLAB bracket rate ${b.rate} must be within [0, 1]`,
        });
      }
    }
  }
}

/**
 * Validate a SLAB bracket table is contiguous: starts at 0, each `to` equals
 * the next `from` (no gaps / overlaps), only the last bracket is open-ended.
 */
function checkSlab(rule: Rule, issues: ValidationIssue[]): void {
  if (rule.type !== RuleType.SLAB) return;

  const brackets: SlabBracket[] = rule.params?.brackets ?? [];
  if (brackets.length === 0) {
    issues.push({ code: 'SLAB_EMPTY', ruleKey: rule.key, message: 'SLAB has no brackets' });
    return;
  }

  // Sort by lower bound to validate ordering independent of authoring order.
  const sorted = [...brackets].sort((a, b) => a.from - b.from);

  if (sorted[0].from !== 0) {
    issues.push({
      code: 'SLAB_GAP',
      ruleKey: rule.key,
      message: `SLAB must start at 0, starts at ${sorted[0].from}`,
    });
  }

  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    const isLast = i === sorted.length - 1;
    const hasUpper = b.to !== null && b.to !== undefined;

    if (hasUpper && (b.to as number) <= b.from) {
      issues.push({
        code: 'SLAB_BAD_BOUNDS',
        ruleKey: rule.key,
        message: `SLAB bracket [${b.from}, ${b.to}) has non-positive width`,
      });
    }

    if (!isLast) {
      if (!hasUpper) {
        issues.push({
          code: 'SLAB_BAD_BOUNDS',
          ruleKey: rule.key,
          message: `Only the top SLAB bracket may be open-ended; bracket from ${b.from} is open mid-table`,
        });
        continue;
      }
      const next = sorted[i + 1];
      if ((b.to as number) < next.from) {
        issues.push({
          code: 'SLAB_GAP',
          ruleKey: rule.key,
          message: `SLAB gap between ${b.to} and ${next.from}`,
        });
      } else if ((b.to as number) > next.from) {
        issues.push({
          code: 'SLAB_OVERLAP',
          ruleKey: rule.key,
          message: `SLAB overlap: bracket ends at ${b.to} but next starts at ${next.from}`,
        });
      }
    }
  }
}

/**
 * Validate the rule DAG: every non-external read is produced by some rule,
 * each context key is written at most once, and the read/write graph is acyclic.
 * A topological order existing proves the engine can schedule the rules (D2).
 */
function checkDag(rules: Rule[], issues: ValidationIssue[]): void {
  const writers = new Map<string, string>(); // writes key -> ruleKey
  for (const r of rules) {
    if (!r.writes) {
      issues.push({ code: 'MISSING_WRITE', ruleKey: r.key, message: 'Rule has no writes key' });
      continue;
    }
    if (writers.has(r.writes)) {
      issues.push({
        code: 'DUPLICATE_WRITE',
        ruleKey: r.key,
        message: `Context key "${r.writes}" is written by both ${writers.get(r.writes)} and ${r.key}`,
      });
    } else {
      writers.set(r.writes, r.key);
    }
  }

  // Every read must be satisfied by a writer or be an external input.
  for (const r of rules) {
    for (const dep of r.reads) {
      if (isExternalRead(dep)) continue;
      if (!writers.has(dep)) {
        issues.push({
          code: 'UNSATISFIED_READ',
          ruleKey: r.key,
          message: `Read "${dep}" is not produced by any rule and is not an external input`,
        });
      }
    }
  }

  // Cycle detection via DFS over rule -> (rules that produce its reads).
  const byKey = new Map(rules.map((r) => [r.key, r]));
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(rules.map((r) => [r.key, WHITE]));

  const visit = (ruleKey: string): boolean => {
    color.set(ruleKey, GRAY);
    const rule = byKey.get(ruleKey)!;
    for (const dep of rule.reads) {
      if (isExternalRead(dep)) continue;
      const producer = writers.get(dep);
      if (!producer || producer === ruleKey) continue;
      const c = color.get(producer);
      if (c === GRAY) {
        issues.push({
          code: 'DAG_CYCLE',
          ruleKey: ruleKey,
          message: `Dependency cycle involving ${ruleKey} and ${producer}`,
        });
        return true;
      }
      if (c === WHITE && visit(producer)) return true;
    }
    color.set(ruleKey, BLACK);
    return false;
  };

  for (const r of rules) {
    if (color.get(r.key) === WHITE) {
      if (visit(r.key)) break; // one cycle is enough to reject
    }
  }
}

/**
 * Full publish-time validation. Returns the list of issues; empty == valid.
 * Used by `validate()` / `save()` to refuse publishing a broken ruleset (D2).
 */
export function validateRuleSet(rs: RuleSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of rs.rules) {
    checkRates(rule, issues);
    checkSlab(rule, issues);
  }
  checkDag(rs.rules, issues);

  return issues;
}
