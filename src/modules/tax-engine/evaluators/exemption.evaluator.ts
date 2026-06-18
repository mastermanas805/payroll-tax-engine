import { Injectable } from '@nestjs/common';
import {
  RuleEvaluator,
  Rule,
  RuleType,
  CalculationContext,
  CalculationInput,
  M,
  min,
  max,
  InvalidRuleSetException,
} from 'src/shared';
import { Decimal } from 'decimal.js';
import { applyLogic } from '../jsonlogic';

/**
 * EXEMPTION — computes a tax exemption / deduction figure, then clamps it to the
 * base component it is exempting against (an exemption can never exceed its base).
 *
 * params (one of):
 *   amount: number              => fixed exemption (e.g. Standard Deduction)
 *   cap:    number              => exemption is min(base, cap) (e.g. 80C cap ₹150,000)
 *   expr:   JsonLogic           => computed exemption (e.g. HRA exemption least-of-three)
 * and:
 *   base?:  string context key  => clamp result to ctx[base] (defaults to reads[0]);
 *                                  set base to null/'' to skip base clamping.
 *
 * The produced figure is clamped to [0, base].
 */
@Injectable()
export class ExemptionEvaluator implements RuleEvaluator {
  readonly type = RuleType.EXEMPTION;

  evaluate(rule: Rule, ctx: CalculationContext, input: CalculationInput): void {
    const params = rule.params ?? {};
    let value: Decimal;

    if (params.expr !== undefined && params.expr !== null) {
      const raw = applyLogic(params.expr, ctx, input);
      if (typeof raw !== 'number' && typeof raw !== 'string') {
        throw new InvalidRuleSetException(
          `EXEMPTION rule '${rule.key}' expression did not evaluate to a number`,
          { rule: rule.key, value: raw },
        );
      }
      value = M(raw);
    } else if (params.amount !== undefined && params.amount !== null) {
      value = M(params.amount);
    } else if (params.cap !== undefined && params.cap !== null) {
      value = M(params.cap);
    } else {
      throw new InvalidRuleSetException(
        `EXEMPTION rule '${rule.key}' needs one of params.expr | params.amount | params.cap`,
        { rule: rule.key },
      );
    }

    // Apply an explicit cap if present alongside expr/amount.
    if (params.cap !== undefined && params.cap !== null) {
      value = min(value, M(params.cap));
    }

    // Clamp to base component (an exemption cannot exceed the thing it exempts).
    const hasBaseKey = 'base' in params;
    const baseKey: string | undefined = hasBaseKey ? params.base : rule.reads?.[0];
    if (baseKey) {
      value = min(value, ctx.get(baseKey));
    }

    value = max(value, M(0));
    ctx.set(rule.writes, value);
  }
}
