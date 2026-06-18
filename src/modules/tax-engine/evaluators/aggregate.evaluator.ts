import { Injectable } from '@nestjs/common';
import {
  RuleEvaluator,
  Rule,
  RuleType,
  CalculationContext,
  CalculationInput,
  M,
} from 'src/shared';
import { Decimal } from 'decimal.js';

/**
 * AGGREGATE — writes = SUM of the referenced context keys.
 *
 * Refs default to rule.reads; params.refs may override. Used for
 * derived:EMPLOYER_COST = EPF + Gratuity + ESI, component:GROSS, etc.
 */
@Injectable()
export class AggregateEvaluator implements RuleEvaluator {
  readonly type = RuleType.AGGREGATE;

  evaluate(rule: Rule, ctx: CalculationContext, _input: CalculationInput): void {
    const refs: string[] = rule.params?.refs ?? rule.reads ?? [];
    let total: Decimal = M(0);
    for (const ref of refs) {
      total = total.plus(ctx.get(ref));
    }
    ctx.set(rule.writes, total);
  }
}
