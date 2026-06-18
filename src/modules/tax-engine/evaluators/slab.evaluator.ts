import { Injectable } from '@nestjs/common';
import {
  RuleEvaluator,
  Rule,
  RuleType,
  SlabBracket,
  CalculationContext,
  CalculationInput,
  M,
  max,
  InvalidRuleSetException,
} from 'src/shared';
import { Decimal } from 'decimal.js';

/**
 * SLAB — progressive bracket tax with ordered post-processors.
 *
 * params:
 *   brackets: SlabBracket[]                progressive marginal brackets (from/to/rate)
 *   base?:    string                       taxable-income key (defaults to reads[0])
 *   postProcessors?: PostProcessorSpec[]   applied IN ORDER after the base slab tax:
 *      { kind: 'REBATE_87A', limit, maxRebate }   zero the tax if taxable <= limit (capped at maxRebate)
 *      { kind: 'SURCHARGE', bands: [{ threshold, rate }, ...] }  marginal-relief surcharge on income bands
 *      { kind: 'CESS_4PCT', rate? }                health & education cess (default 4%) on (tax + surcharge)
 *
 * The slab tax is computed by summing rate * (overlap of income with each bracket).
 * REBATE_87A / SURCHARGE / CESS_4PCT are India's TDS post-steps (engine-implemented).
 */
@Injectable()
export class SlabEvaluator implements RuleEvaluator {
  readonly type = RuleType.SLAB;

  evaluate(rule: Rule, ctx: CalculationContext, _input: CalculationInput): void {
    const params = rule.params ?? {};
    const brackets: SlabBracket[] = params.brackets;
    if (!Array.isArray(brackets) || brackets.length === 0) {
      throw new InvalidRuleSetException(
        `SLAB rule '${rule.key}' is missing params.brackets`,
        { rule: rule.key },
      );
    }

    const baseKey: string = params.base ?? rule.reads?.[0];
    const income = ctx.get(baseKey);

    let tax = this.slabTax(income, brackets);
    let surcharge = M(0);

    // Post-processors may be declared either as objects ({ kind, ...config })
    // or as bare string identifiers ("REBATE_87A") whose config lives in a
    // sibling param (e.g. params.rebate87A, params.surcharge). Both shapes are
    // normalized to { kind, config } here so the engine accepts the real
    // rulesets unchanged.
    const postProcessors: any[] = params.postProcessors ?? [];
    for (const raw of postProcessors) {
      const kind: string = typeof raw === 'string' ? raw : raw?.kind;
      const cfg = this.postProcessorConfig(kind, raw, params);
      switch (kind) {
        case 'REBATE_87A':
          tax = this.rebate87A(tax, income, cfg);
          break;
        case 'SURCHARGE':
          surcharge = this.surcharge(tax, income, cfg);
          break;
        case 'CESS_4PCT': {
          const rate = cfg.rate ?? 0.04;
          const cess = tax.plus(surcharge).times(rate);
          tax = tax.plus(surcharge).plus(cess);
          surcharge = M(0); // folded into tax
          break;
        }
        default:
          throw new InvalidRuleSetException(
            `SLAB rule '${rule.key}' has unknown post-processor '${kind}'`,
            { rule: rule.key, kind },
          );
      }
    }

    // Fold any unconsumed surcharge (e.g. no CESS step) into the final tax.
    tax = tax.plus(surcharge);
    tax = max(tax, M(0));

    // `annual: true` means the SLAB ran on an annualized base (e.g. gross*12
    // minus annual deductions); the rest of the breakdown is monthly, so divide
    // the annual tax back to a monthly figure before writing tax:TDS.
    if (params.annual === true) {
      tax = tax.div(12);
    }

    ctx.set(rule.writes, tax);
  }

  /**
   * Resolve a post-processor's config. For object form, the object IS the config.
   * For string form, the config is read from a sibling param keyed by a
   * lower-camel alias (REBATE_87A -> params.rebate87A, SURCHARGE -> params.surcharge,
   * CESS_4PCT -> params.cess), defaulting to {} when absent.
   */
  private postProcessorConfig(kind: string, raw: any, params: any): any {
    if (raw && typeof raw === 'object') {
      return raw;
    }
    const aliases: Record<string, string> = {
      REBATE_87A: 'rebate87A',
      SURCHARGE: 'surcharge',
      CESS_4PCT: 'cess',
    };
    const key = aliases[kind];
    return (key && params[key]) || {};
  }

  /** Progressive marginal tax: sum over brackets of rate * overlap(income, bracket). */
  private slabTax(income: Decimal, brackets: SlabBracket[]): Decimal {
    let tax = M(0);
    for (const b of brackets) {
      const from = M(b.from);
      if (income.lessThanOrEqualTo(from)) {
        continue;
      }
      const upper = b.to === undefined || b.to === null ? income : Decimal.min(income, M(b.to));
      const span = upper.minus(from);
      if (span.greaterThan(0)) {
        tax = tax.plus(span.times(b.rate));
      }
    }
    return tax;
  }

  /** Section 87A rebate: if taxable income <= limit, tax is reduced (capped at maxRebate). */
  private rebate87A(tax: Decimal, income: Decimal, pp: any): Decimal {
    const limit = M(pp.limit ?? pp.threshold);
    if (income.lessThanOrEqualTo(limit)) {
      const maxRebate = pp.maxRebate !== undefined ? M(pp.maxRebate) : tax;
      const rebate = Decimal.min(tax, maxRebate);
      return max(tax.minus(rebate), M(0));
    }
    return tax;
  }

  /**
   * Surcharge with marginal relief: pick the highest band whose threshold the
   * income exceeds and apply its rate to the base tax. Marginal relief caps the
   * surcharge so (tax + surcharge) does not exceed (tax-at-threshold + excess income).
   */
  private surcharge(tax: Decimal, income: Decimal, pp: any): Decimal {
    const bands: Array<{ threshold: number; rate: number }> = pp.bands ?? [];
    let applicable: { threshold: number; rate: number } | undefined;
    for (const band of bands) {
      if (income.greaterThan(M(band.threshold))) {
        if (!applicable || band.threshold > applicable.threshold) {
          applicable = band;
        }
      }
    }
    if (!applicable) {
      return M(0);
    }

    let surcharge = tax.times(applicable.rate);

    // Marginal relief: surcharge cannot exceed the income above the threshold.
    const excess = income.minus(M(applicable.threshold));
    if (surcharge.greaterThan(excess) && excess.greaterThanOrEqualTo(0)) {
      surcharge = max(excess, M(0));
    }
    return surcharge;
  }
}
