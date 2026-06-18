import { Injectable } from '@nestjs/common';
import { RuleEvaluator, RuleType, InvalidRuleSetException } from 'src/shared';
import { PercentageOfEvaluator } from './evaluators/percentage-of.evaluator';
import { FixedEvaluator } from './evaluators/fixed.evaluator';
import { SlabEvaluator } from './evaluators/slab.evaluator';
import { FormulaEvaluator } from './evaluators/formula.evaluator';
import { AggregateEvaluator } from './evaluators/aggregate.evaluator';
import { ExemptionEvaluator } from './evaluators/exemption.evaluator';

/**
 * EvaluatorRegistry — the OCP dispatch table (NFR-3). Maps RuleType -> RuleEvaluator.
 * Adding a new primitive = register one new evaluator here; the engine itself is closed.
 */
@Injectable()
export class EvaluatorRegistry {
  private readonly evaluators = new Map<RuleType, RuleEvaluator>();

  constructor(
    percentageOf: PercentageOfEvaluator,
    fixed: FixedEvaluator,
    slab: SlabEvaluator,
    formula: FormulaEvaluator,
    aggregate: AggregateEvaluator,
    exemption: ExemptionEvaluator,
  ) {
    for (const evaluator of [percentageOf, fixed, slab, formula, aggregate, exemption]) {
      this.register(evaluator);
    }
  }

  register(evaluator: RuleEvaluator): void {
    this.evaluators.set(evaluator.type, evaluator);
  }

  get(type: RuleType): RuleEvaluator {
    const evaluator = this.evaluators.get(type);
    if (!evaluator) {
      throw new InvalidRuleSetException(`No evaluator registered for rule type '${type}'`, {
        type,
      });
    }
    return evaluator;
  }
}
