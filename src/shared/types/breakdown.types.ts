import { Category } from './ruleset.types';

/**
 * Calculation input/output types — the structured breakdown contract (FR-7).
 *
 * Amounts here are plain numbers (2-decimal in API responses). INTERNALLY the
 * engine works in decimal.js; numbers only appear at the serialization boundary.
 */

/** How the salary was supplied (D9: both CTC and Gross supported, CTC primary). */
export interface PayBasis {
  type: 'CTC' | 'GROSS';
  /** monthly amount in the ruleset currency. */
  amount: number;
}

/** Employee tax declarations driving conditional/exemption rules (FR-4). */
export interface Declarations {
  /** annual/monthly rent paid (used by HRA exemption, OLD regime). */
  rentPaid?: number;
  /** 80C eligible investment amount (OLD regime). */
  section80C?: number;
  /** true if employee lives in a metro city (HRA exemption % differs). */
  metro?: boolean;
  /** nationality / residency flag if a rule needs it. */
  nationality?: string;
}

/** Full input to one calculation (an employee for one period). */
export interface CalculationInput {
  payBasis: PayBasis;
  declarations: Declarations;
  /** period label, e.g. "2025-06" (YYYY-MM). Drives ruleset resolution (D4/NFR-5). */
  period: string;
  /** tax regime, e.g. "OLD" | "NEW". */
  regime: string;
}

/** A single rendered line in the breakdown, fully traceable (NFR-2). */
export interface LineItem {
  category: Category;
  label: string;
  /** 2-decimal amount in the ruleset currency. */
  amount: number;
  /** the Rule.key that produced this line (audit trace). */
  ruleKey: string;
  /** optional human explanation rendered from the rule's explainTemplate. */
  explanation?: string;
}

/** The structured breakdown, grouped by category (FR-7). */
export interface Breakdown {
  earnings: LineItem[];
  employeeDeductions: LineItem[];
  employerContributions: LineItem[];
  taxes: LineItem[];
  exemptions: LineItem[];
}

/** Reconciled totals (FR-8: lines must sum to input). */
export interface PayrollSummary {
  /** total earnings (gross pay). */
  gross: number;
  /** sum of all employee-side deductions incl. taxes. */
  totalEmployeeDeductions: number;
  /** gross − totalEmployeeDeductions. */
  netPay: number;
  /** gross + employer contributions (true cost to company). */
  totalEmployerCost: number;
  /** cost to company (the CTC figure the run reconciles against). */
  ctc: number;
}

/** The complete deterministic result of a calculation. */
export interface CalculationResult {
  breakdown: Breakdown;
  summary: PayrollSummary;
  /** the ruleset id@version that produced this result (audit trace). */
  rulesetVersion: string;
  /** unique id correlating this calculation in logs / audit replay. */
  traceId: string;
}
