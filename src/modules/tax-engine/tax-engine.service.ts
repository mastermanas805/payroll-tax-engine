import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  TaxEngineService as ITaxEngineService,
  RuleSet,
  Rule,
  Category,
  CalculationContext,
  CalculationInput,
  CalculationResult,
  LineItem,
  RoundingConfig,
  M,
  roundTo,
  InvalidInputException,
} from 'src/shared';
import { Decimal } from 'decimal.js';
import { EvaluatorRegistry } from './evaluator-registry';
import { ReconciliationService } from './reconciliation.service';
import { topologicalSort } from './topological-sort';
import { isEligible, applyLogic } from './jsonlogic';

/** Default rounding when a ruleset omits the config (D5: round-at-line HALF_UP, unit 1). */
const DEFAULT_ROUNDING: RoundingConfig = { unit: 1, strategy: 'HALF_UP' };

/**
 * TaxEngineService — the pure, country-agnostic calculation core (D1–D5).
 *
 * Pipeline:
 *   1. seed a CalculationContext from input.payBasis (input:CTC or input:GROSS)
 *   2. topologically sort the rules by declared reads/writes (D2)
 *   3. evaluate each rule in order: skip if its JsonLogic condition is false
 *      (eligibility, e.g. ESI); else dispatch by type via the EvaluatorRegistry
 *   4. round each produced line per ruleset.rounding (D5)
 *   5. reconcile (FR-8) or refuse to emit
 *   6. assemble Breakdown + PayrollSummary + CalculationResult (trace).
 *
 * Deterministic and side-effect free: same (ruleSet, input) => identical result.
 * Bound to the TAX_ENGINE token and exported from TaxEngineModule.
 */
@Injectable()
export class TaxEngineService implements ITaxEngineService {
  constructor(
    private readonly registry: EvaluatorRegistry,
    private readonly reconciliation: ReconciliationService,
  ) {}

  calculate(ruleSet: RuleSet, input: CalculationInput): CalculationResult {
    this.validateInput(input);

    const rounding = ruleSet.rounding ?? DEFAULT_ROUNDING;
    const ctx = new CalculationContext();

    // 1. Seed the context from the pay basis.
    this.seed(ctx, input);

    // 2. Topological sort (throws InvalidRuleSetException on cycle / unsatisfied dep).
    const ordered = topologicalSort(ruleSet);

    // 3 + 4. Evaluate each rule in order, with eligibility + per-line rounding.
    const lineItems: LineItem[] = [];
    for (const rule of ordered) {
      if (!isEligible(rule.condition, ctx, input)) {
        // Skipped (ineligible). Seed a 0 so downstream reads/aggregates are well-defined.
        if (!ctx.has(rule.writes)) {
          ctx.set(rule.writes, M(0));
        }
        continue;
      }

      const evaluator = this.registry.get(rule.type);
      evaluator.evaluate(rule, ctx, input);

      // Round at line (D5) and persist the rounded value back into the context so
      // downstream rules read the rounded figure (round-at-line semantics).
      const rounded = roundTo(ctx.get(rule.writes), rounding.unit, rounding.strategy);
      ctx.set(rule.writes, rounded);

      lineItems.push(this.toLineItem(rule, rounded, ctx, input));
    }

    // 5. Reconcile or refuse. Earnings must sum to component:GROSS.
    const grossTarget = ctx.has('component:GROSS')
      ? ctx.get('component:GROSS')
      : this.sumEarnings(lineItems);

    const { lineItems: balanced, summary } = this.reconciliation.reconcile(
      lineItems,
      grossTarget,
      rounding,
    );

    // 6. Assemble the result.
    const breakdown = this.reconciliation.toBreakdown(balanced);
    return {
      breakdown,
      summary,
      rulesetVersion: `${ruleSet.id}@${ruleSet.version}`,
      traceId: randomUUID(),
    };
  }

  /** Seed input:CTC / input:GROSS from the pay basis (the engine's only entry seeds). */
  private seed(ctx: CalculationContext, input: CalculationInput): void {
    const amount = M(input.payBasis.amount);
    if (input.payBasis.type === 'CTC') {
      ctx.set('input:CTC', amount);
    } else {
      ctx.set('input:GROSS', amount);
    }
  }

  private validateInput(input: CalculationInput): void {
    if (!input || !input.payBasis) {
      throw new InvalidInputException('Calculation input is missing a pay basis');
    }
    const { type, amount } = input.payBasis;
    if (type !== 'CTC' && type !== 'GROSS') {
      throw new InvalidInputException(`Unsupported pay basis type '${type}'`, { type });
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      throw new InvalidInputException('Pay basis amount must be a non-negative finite number', {
        amount,
      });
    }
  }

  private sumEarnings(lineItems: LineItem[]): Decimal {
    return lineItems
      .filter((li) => li.category === Category.EARNING)
      .reduce((acc, li) => acc.plus(M(li.amount)), M(0));
  }

  private toLineItem(
    rule: Rule,
    value: Decimal,
    ctx: CalculationContext,
    input: CalculationInput,
  ): LineItem {
    return {
      category: rule.category,
      label: rule.label,
      amount: value.toNumber(),
      ruleKey: rule.key,
      explanation: this.renderExplanation(rule, ctx, input),
    };
  }

  /**
   * Render a line explanation. explainTemplate may be a JsonLogic document
   * (evaluated in the sandbox) or a plain string; otherwise omitted.
   */
  private renderExplanation(
    rule: Rule,
    ctx: CalculationContext,
    input: CalculationInput,
  ): string | undefined {
    const tpl = rule.explainTemplate;
    if (tpl === undefined || tpl === null) {
      return undefined;
    }
    if (typeof tpl === 'string') {
      return tpl;
    }
    const rendered = applyLogic(tpl, ctx, input);
    return rendered === undefined || rendered === null ? undefined : String(rendered);
  }
}
