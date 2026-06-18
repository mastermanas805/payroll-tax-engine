import { Injectable } from '@nestjs/common';
import {
  RuleEvaluator,
  Rule,
  RuleType,
  CalculationContext,
  CalculationInput,
  M,
  max,
  InvalidRuleSetException,
} from 'src/shared';
import { applyLogic } from '../jsonlogic';

/**
 * FORMULA — writes = result of a sandboxed JsonLogic expression (params.expr),
 * evaluated against { ...contextValues, declarations, context, input } (D3, no eval).
 *
 * e.g. derived:TAXABLE_INCOME = component:GROSS - exemption:STD - exemption:HRA - exemption:80C.
 * Optional params.clampZero (default true) prevents negative derived figures
 * (taxable income, net pay components never go below 0).
 */
@Injectable()
export class FormulaEvaluator implements RuleEvaluator {
  readonly type = RuleType.FORMULA;

  evaluate(rule: Rule, ctx: CalculationContext, input: CalculationInput): void {
    const expr = rule.params?.expr;
    if (expr === undefined || expr === null) {
      throw new InvalidRuleSetException(
        `FORMULA rule '${rule.key}' is missing params.expr`,
        { rule: rule.key },
      );
    }

    const raw = applyLogic(expr, ctx, input);
    if (typeof raw !== 'number' && typeof raw !== 'string') {
      throw new InvalidRuleSetException(
        `FORMULA rule '${rule.key}' expression did not evaluate to a number`,
        { rule: rule.key, value: raw },
      );
    }

    let result = M(raw);
    const clampZero = rule.params?.clampZero !== false;
    if (clampZero) {
      result = max(result, M(0));
    }

    ctx.set(rule.writes, result);
  }
}
