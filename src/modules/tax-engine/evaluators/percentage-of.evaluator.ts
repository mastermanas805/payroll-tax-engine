import { Injectable } from '@nestjs/common';
import {
  RuleEvaluator,
  Rule,
  RuleType,
  CalculationContext,
  CalculationInput,
  M,
  percent,
  min,
  max,
  InvalidRuleSetException,
} from 'src/shared';
import { Decimal } from 'decimal.js';

/**
 * PERCENTAGE_OF — writes = rate * base, with optional cap / floor.
 *
 * params:
 *   rate:   number (0..1), required
 *   base:   string context key to multiply (defaults to reads[0])
 *   cap?:   { kind: 'ABSOLUTE'|'BASE_CEILING', value: number }
 *            - ABSOLUTE     => result is min(result, value)
 *            - BASE_CEILING => the base itself is capped at value before applying rate
 *              (e.g. EPF wage ceiling ₹15,000: 12% of min(Basic, 15000))
 *   floor?: number  => result is max(result, floor)
 *
 * Examples: HRA = 50% of Basic; Employer EPF = 12% of min(Basic, 15000).
 */
@Injectable()
export class PercentageOfEvaluator implements RuleEvaluator {
  readonly type = RuleType.PERCENTAGE_OF;

  evaluate(rule: Rule, ctx: CalculationContext, _input: CalculationInput): void {
    const params = rule.params ?? {};
    const baseKey: string | undefined = params.base ?? rule.reads?.[0];
    if (!baseKey) {
      throw new InvalidRuleSetException(
        `PERCENTAGE_OF rule '${rule.key}' has no base key (params.base or reads[0])`,
        { rule: rule.key },
      );
    }
    if (params.rate === undefined || params.rate === null) {
      throw new InvalidRuleSetException(
        `PERCENTAGE_OF rule '${rule.key}' is missing params.rate`,
        { rule: rule.key },
      );
    }

    let base: Decimal = ctx.get(baseKey);
    const cap = params.cap;

    if (cap && cap.kind === 'BASE_CEILING') {
      base = min(base, M(cap.value));
    }

    let result = percent(base, params.rate);

    if (cap && cap.kind === 'ABSOLUTE') {
      result = min(result, M(cap.value));
    }

    if (params.floor !== undefined && params.floor !== null) {
      result = max(result, M(params.floor));
    }

    ctx.set(rule.writes, result);
  }
}
