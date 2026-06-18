import { RuleSet } from '../types/ruleset.types';
import { CalculationInput, CalculationResult } from '../types/breakdown.types';

/**
 * TaxEngineService — the pure calculation facade (NFR-1, NFR-9 DIP at the facade).
 * Deterministic: same (ruleSet, input) => identical CalculationResult to the paisa.
 * MUST reconcile or throw ReconciliationException (FR-8). Bind to the TAX_ENGINE token.
 */
export interface TaxEngineService {
  /** Compute the full reconciled breakdown for one employee/period. */
  calculate(ruleSet: RuleSet, input: CalculationInput): CalculationResult;
}
