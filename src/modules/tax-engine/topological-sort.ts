import { Rule, RuleSet, InvalidRuleSetException } from 'src/shared';

/**
 * Topological sort of a ruleset's rules by declared reads/writes (D2, Kahn's algorithm).
 *
 * Edge: ruleA -> ruleB iff ruleB.reads contains ruleA.writes (B depends on A).
 * A rule's reads that are NOT produced by any rule are treated as engine-seeded
 * inputs (e.g. input:CTC, declarations) — they impose no ordering constraint, but
 * any read that is neither seeded nor produced is an unsatisfied dependency.
 *
 * Throws InvalidRuleSetException on:
 *   - a dependency cycle, or
 *   - an unsatisfied dependency (a read no rule produces and the engine didn't seed).
 */

/** Context keys the engine guarantees to seed before any rule runs. */
const SEEDED_KEYS = new Set<string>(['input:CTC', 'input:GROSS']);

export function topologicalSort(ruleSet: RuleSet): Rule[] {
  const rules = ruleSet.rules;

  // Map each produced key -> the rule that writes it.
  const writers = new Map<string, Rule>();
  for (const rule of rules) {
    if (writers.has(rule.writes)) {
      throw new InvalidRuleSetException(
        `Multiple rules write the same key '${rule.writes}'`,
        { key: rule.writes, rules: [writers.get(rule.writes)!.key, rule.key] },
      );
    }
    writers.set(rule.writes, rule);
  }

  // Validate every read is either seeded or produced by some rule.
  for (const rule of rules) {
    for (const dep of rule.reads ?? []) {
      if (!SEEDED_KEYS.has(dep) && !writers.has(dep)) {
        throw new InvalidRuleSetException(
          `Rule '${rule.key}' reads '${dep}' which no rule produces and the engine does not seed`,
          { rule: rule.key, missing: dep },
        );
      }
    }
  }

  // Build adjacency + in-degrees. dependency -> dependent.
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, Rule[]>();
  for (const rule of rules) {
    inDegree.set(rule.key, 0);
    adjacency.set(rule.key, []);
  }

  for (const rule of rules) {
    for (const dep of rule.reads ?? []) {
      const producer = writers.get(dep);
      if (!producer || producer.key === rule.key) {
        continue;
      }
      adjacency.get(producer.key)!.push(rule);
      inDegree.set(rule.key, (inDegree.get(rule.key) ?? 0) + 1);
    }
  }

  // Kahn's algorithm. Preserve declaration order among ready nodes for determinism.
  const queue: Rule[] = rules.filter((r) => (inDegree.get(r.key) ?? 0) === 0);
  const sorted: Rule[] = [];

  while (queue.length > 0) {
    const rule = queue.shift()!;
    sorted.push(rule);
    for (const dependent of adjacency.get(rule.key)!) {
      const remaining = (inDegree.get(dependent.key) ?? 0) - 1;
      inDegree.set(dependent.key, remaining);
      if (remaining === 0) {
        queue.push(dependent);
      }
    }
  }

  if (sorted.length !== rules.length) {
    const cyclic = rules.filter((r) => (inDegree.get(r.key) ?? 0) > 0).map((r) => r.key);
    throw new InvalidRuleSetException('Ruleset has a dependency cycle', { cyclic });
  }

  return sorted;
}
