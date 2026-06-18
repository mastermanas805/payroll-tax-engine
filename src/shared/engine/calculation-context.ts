import { Decimal } from 'decimal.js';

/**
 * CalculationContext — the mutable "blackboard" rules read from and write to.
 *
 * Wraps a Map<string, Decimal> keyed by the canonical context keys
 * (input:CTC, component:BASIC, deduction:EPF, derived:NET, ...). All values are
 * decimal.js to guarantee zero float error (NFR-1). Numbers are only produced at
 * the serialization boundary via getNumber()/snapshot().
 */
export class CalculationContext {
  private readonly values = new Map<string, Decimal>();

  /** Returns the Decimal at `key`, or Decimal(0) if unset (rules read defensively). */
  get(key: string): Decimal {
    return this.values.get(key) ?? new Decimal(0);
  }

  /** Sets `key` to a Decimal value. */
  set(key: string, value: Decimal): void {
    this.values.set(key, value);
  }

  /** True if `key` has been explicitly written. */
  has(key: string): boolean {
    return this.values.has(key);
  }

  /** All keys currently in the context. */
  keys(): string[] {
    return Array.from(this.values.keys());
  }

  /** The numeric value at `key` (for serialization / JsonLogic input). */
  getNumber(key: string): number {
    return this.get(key).toNumber();
  }

  /** Plain { key: number } snapshot of the whole context (logging / JsonLogic data). */
  snapshot(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.values.entries()) {
      out[k] = v.toNumber();
    }
    return out;
  }
}
