import * as jsonLogic from 'json-logic-js';
import { CalculationContext } from 'src/shared';
import { CalculationInput } from 'src/shared';

/**
 * Sandboxed expression evaluation (D3): JsonLogic only, NO eval.
 *
 * Predicates (`rule.condition`) and FORMULA `params.expr` are JsonLogic documents
 * evaluated against a flat data object:
 *   { ...contextValues, declarations, context }
 * where contextValues is the numeric snapshot of the CalculationContext, so a rule
 * can reference a canonical key directly via {"var": "component:BASIC"} as well as
 * declarations via {"var": "declarations.rentPaid"}.
 */
export function buildData(
  ctx: CalculationContext,
  input: CalculationInput,
): Record<string, unknown> {
  const snapshot = ctx.snapshot();
  return {
    ...snapshot,
    declarations: input.declarations ?? {},
    context: snapshot,
    input: {
      payBasis: input.payBasis,
      period: input.period,
      regime: input.regime,
    },
  };
}

/** Apply a JsonLogic document against the engine's sandboxed data object. */
export function applyLogic(
  logic: unknown,
  ctx: CalculationContext,
  input: CalculationInput,
): unknown {
  return jsonLogic.apply(logic as any, buildData(ctx, input));
}

/**
 * Evaluate an eligibility predicate. A missing condition means "always eligible".
 * Anything truthy => eligible.
 */
export function isEligible(
  condition: unknown,
  ctx: CalculationContext,
  input: CalculationInput,
): boolean {
  if (condition === undefined || condition === null) {
    return true;
  }
  return Boolean(applyLogic(condition, ctx, input));
}
