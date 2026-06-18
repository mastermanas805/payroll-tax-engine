/**
 * Ruleset domain types — "tax logic is data" (D1).
 *
 * A RuleSet is an effective-dated, versioned, immutable bundle of Rules for a
 * (country, regime, financialYear). The engine evaluates the rules in declared
 * topological order (D2) and groups the resulting line items by `category`.
 */

/** The closed catalog of primitive rule types the engine knows how to evaluate (D3). */
export enum RuleType {
  /** writes = params.rate (0..1) * read base, e.g. HRA = 50% of Basic. */
  PERCENTAGE_OF = 'PERCENTAGE_OF',
  /** writes = params.amount (a fixed figure, e.g. Professional Tax ₹200). */
  FIXED = 'FIXED',
  /** progressive slab table; params.brackets: SlabBracket[]; supports post-processors. */
  SLAB = 'SLAB',
  /** writes = JsonLogic expression in params.expr evaluated over the context. */
  FORMULA = 'FORMULA',
  /** writes = sum of the `reads` keys (e.g. EMPLOYER_COST aggregate). */
  AGGREGATE = 'AGGREGATE',
  /** computes a tax exemption / deduction figure (e.g. HRA exemption, 80C, std deduction). */
  EXEMPTION = 'EXEMPTION',
}

/** Which bucket a rule's output line item belongs to (drives Breakdown grouping). */
export enum Category {
  EARNING = 'EARNING',
  EMPLOYEE_DEDUCTION = 'EMPLOYEE_DEDUCTION',
  EMPLOYER_CONTRIBUTION = 'EMPLOYER_CONTRIBUTION',
  TAX = 'TAX',
  EXEMPTION = 'EXEMPTION',
  /** intermediate / derived value that is not itself a payslip line (e.g. TAXABLE_INCOME). */
  INFO = 'INFO',
}

/** Rounding policy for the ruleset (D5: rounding is country law). */
export interface RoundingConfig {
  /** smallest currency unit to round to, e.g. 1 (rupee) or 0.01 (paisa). */
  unit: number;
  /** rounding strategy applied at each line. */
  strategy: 'HALF_UP' | 'HALF_EVEN' | 'CEIL' | 'FLOOR' | 'TRUNCATE';
}

/** One bracket in a progressive SLAB table. */
export interface SlabBracket {
  /** lower bound (inclusive) of taxable income for this bracket. */
  from: number;
  /** upper bound (exclusive); null/undefined = no upper bound (top slab). */
  to?: number | null;
  /** marginal rate applied within the bracket (0..1). */
  rate: number;
}

/** A single declarative rule (control flow is data, not code — D1/D3). */
export interface Rule {
  /** stable identifier, unique within the ruleset; appears in the audit trace. */
  key: string;
  /** which primitive evaluator handles this rule. */
  type: RuleType;
  /** output bucket for the produced line item. */
  category: Category;
  /** context keys this rule consumes (drives the topological sort — D2). */
  reads: string[];
  /** context key this rule produces (drives the topological sort — D2). */
  writes: string;
  /**
   * optional JsonLogic eligibility predicate. Evaluated against
   * { ...contextValues, declarations, context }. Falsy => rule writes 0 / is skipped.
   */
  condition?: any;
  /** type-specific parameters (rate, amount, brackets, expr, postProcessors, ceiling, ...). */
  params: any;
  /** human-readable line-item label. */
  label: string;
  /** optional template used to render a per-line explanation string. */
  explainTemplate?: string;
}

/** Lifecycle status of a ruleset (immutable once PUBLISHED — NFR-2/NFR-5). */
export type RuleSetStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** A versioned, effective-dated bundle of rules for one (country, regime, FY). */
export interface RuleSet {
  /** unique id, e.g. "IN-OLD-2025-26". */
  id: string;
  /** ISO-3166 country code, e.g. "IN". */
  country: string;
  /** tax regime within the country, e.g. "OLD" | "NEW". */
  regime: string;
  /** financial year label, e.g. "2025-26". */
  financialYear: string;
  /** ISO date (inclusive) this ruleset becomes effective. */
  effectiveFrom: string;
  /** ISO date (inclusive) this ruleset stops being effective; null = open-ended. */
  effectiveTo?: string | null;
  /** monotonically increasing version for the (country, regime, FY). */
  version: number;
  /** publication status. */
  status: RuleSetStatus;
  /** ISO-4217 currency, e.g. "INR". */
  currency: string;
  /** rounding policy. */
  rounding: RoundingConfig;
  /** the declarative rules, evaluated in topologically-sorted order. */
  rules: Rule[];
}
