import { Decimal } from 'decimal.js';
import { RoundingConfig } from '../types/ruleset.types';

/**
 * Money helpers — ALL monetary math goes through decimal.js (NFR-1, zero float).
 * Rounding happens ONLY per the ruleset's RoundingConfig (D5).
 */

/** Construct a Decimal from a number | string | Decimal. */
export function M(n: number | string | Decimal): Decimal {
  return new Decimal(n);
}

/** base * rate, where rate is a fraction (0.12 for 12%). Returns an unrounded Decimal. */
export function percent(base: number | string | Decimal, rate: number | string | Decimal): Decimal {
  return new Decimal(base).times(rate);
}

/** Minimum of the given values as a Decimal. */
export function min(...values: Array<number | string | Decimal>): Decimal {
  return Decimal.min(...values.map((v) => new Decimal(v)));
}

/** Maximum of the given values as a Decimal. */
export function max(...values: Array<number | string | Decimal>): Decimal {
  return Decimal.max(...values.map((v) => new Decimal(v)));
}

/** Map a RoundingConfig strategy to a decimal.js rounding mode. */
function modeFor(strategy: RoundingConfig['strategy']): Decimal.Rounding {
  switch (strategy) {
    case 'HALF_UP':
      return Decimal.ROUND_HALF_UP;
    case 'HALF_EVEN':
      return Decimal.ROUND_HALF_EVEN;
    case 'CEIL':
      return Decimal.ROUND_CEIL;
    case 'FLOOR':
      return Decimal.ROUND_FLOOR;
    case 'TRUNCATE':
      return Decimal.ROUND_DOWN;
    default:
      return Decimal.ROUND_HALF_UP;
  }
}

/**
 * Round `value` to the nearest multiple of `unit` using `strategy`.
 * e.g. roundTo(199.6, 1, 'HALF_UP') => 200 ; roundTo(199.6, 0.01, 'HALF_UP') => 199.6.
 * unit <= 0 is treated as no rounding (returns value unchanged).
 */
export function roundTo(
  value: number | string | Decimal,
  unit: number,
  strategy: RoundingConfig['strategy'],
): Decimal {
  const v = new Decimal(value);
  if (!unit || unit <= 0) {
    return v;
  }
  const u = new Decimal(unit);
  return v.dividedBy(u).toDecimalPlaces(0, modeFor(strategy)).times(u);
}
