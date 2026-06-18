import { Injectable } from '@nestjs/common';
import {
  RuleEvaluator,
  Rule,
  RuleType,
  CalculationContext,
  CalculationInput,
  M,
  InvalidRuleSetException,
} from 'src/shared';

/**
 * FIXED — writes a constant figure (params.amount), e.g. Professional Tax ₹200/mo.
 */
@Injectable()
export class FixedEvaluator implements RuleEvaluator {
  readonly type = RuleType.FIXED;

  evaluate(rule: Rule, ctx: CalculationContext, _input: CalculationInput): void {
    const amount = rule.params?.amount;
    if (amount === undefined || amount === null) {
      throw new InvalidRuleSetException(
        `FIXED rule '${rule.key}' is missing params.amount`,
        { rule: rule.key },
      );
    }
    ctx.set(rule.writes, M(amount));
  }
}
