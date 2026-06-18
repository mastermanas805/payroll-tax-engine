import { Rule, RuleType } from '../types/ruleset.types';
import { CalculationContext } from '../engine/calculation-context';
import { CalculationInput } from '../types/breakdown.types';

/**
 * RuleEvaluator — the OCP extension point (NFR-3). One implementation per
 * RuleType, registered in the engine's evaluator registry. Adding a new
 * primitive = add a new evaluator, no edits to existing ones.
 *
 * evaluate() MUTATES the context (writes `rule.writes`); it returns void.
 */
export interface RuleEvaluator {
  /** the RuleType this evaluator handles (used as the registry key). */
  readonly type: RuleType;
  /** evaluate the rule, writing its result into ctx under rule.writes. */
  evaluate(rule: Rule, ctx: CalculationContext, input: CalculationInput): void;
}
