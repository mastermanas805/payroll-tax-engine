import { Injectable } from '@nestjs/common';
import {
  Category,
  LineItem,
  Breakdown,
  PayrollSummary,
  RoundingConfig,
  M,
  ReconciliationException,
} from 'src/shared';
import { Decimal } from 'decimal.js';

/**
 * Result of reconciliation: the (possibly balance-adjusted) line items plus the
 * reconciled summary. The engine assembles these into the final Breakdown.
 */
export interface ReconciliationResult {
  lineItems: LineItem[];
  summary: PayrollSummary;
}

/**
 * ReconciliationService — the invariant that refuses to emit a payslip that
 * doesn't balance (FR-8, NFR-1).
 *
 * Invariants checked:
 *   - EARNING components sum to component:GROSS (gross).
 *   - netPay  = gross − employee deductions − taxes.
 *   - ctc     = gross + employer contributions.
 *
 * Drift handling (D5): if |drift| <= rounding.unit, add a balancing INFO line and
 * proceed; if the drift is material (> unit), throw ReconciliationException and
 * refuse to emit.
 */
@Injectable()
export class ReconciliationService {
  reconcile(
    lineItems: LineItem[],
    grossTarget: Decimal,
    rounding: RoundingConfig,
  ): ReconciliationResult {
    const unit = M(rounding?.unit && rounding.unit > 0 ? rounding.unit : 0);
    const items = [...lineItems];

    const sumOf = (category: Category): Decimal =>
      items
        .filter((li) => li.category === category)
        .reduce((acc, li) => acc.plus(M(li.amount)), M(0));

    const earnings = sumOf(Category.EARNING);
    const employeeDeductions = sumOf(Category.EMPLOYEE_DEDUCTION);
    const taxes = sumOf(Category.TAX);
    const employerContributions = sumOf(Category.EMPLOYER_CONTRIBUTION);

    // Invariant 1: EARNING components sum to component:GROSS.
    const grossDrift = grossTarget.minus(earnings);
    if (grossDrift.abs().greaterThan(unit)) {
      throw new ReconciliationException(
        'Earnings do not sum to gross; refusing to emit payslip',
        {
          gross: grossTarget.toNumber(),
          earningsSum: earnings.toNumber(),
          drift: grossDrift.toNumber(),
          unit: unit.toNumber(),
        },
      );
    }
    if (!grossDrift.isZero()) {
      items.push({
        category: Category.INFO,
        label: 'Rounding adjustment (gross)',
        amount: grossDrift.toNumber(),
        ruleKey: 'reconcile:gross-balance',
        explanation: 'Balancing entry so earnings reconcile to gross within the rounding unit.',
      });
    }

    const gross = grossTarget;
    const netPay = gross.minus(employeeDeductions).minus(taxes);
    const totalEmployerCost = gross.plus(employerContributions);

    const summary: PayrollSummary = {
      gross: gross.toNumber(),
      totalEmployeeDeductions: employeeDeductions.plus(taxes).toNumber(),
      netPay: netPay.toNumber(),
      totalEmployerCost: totalEmployerCost.toNumber(),
      ctc: totalEmployerCost.toNumber(),
    };

    return { lineItems: items, summary };
  }

  /** Group flat line items into the categorized Breakdown shape. */
  toBreakdown(lineItems: LineItem[]): Breakdown {
    const breakdown: Breakdown = {
      earnings: [],
      employeeDeductions: [],
      employerContributions: [],
      taxes: [],
      exemptions: [],
    };
    for (const li of lineItems) {
      switch (li.category) {
        case Category.EARNING:
          breakdown.earnings.push(li);
          break;
        case Category.EMPLOYEE_DEDUCTION:
          breakdown.employeeDeductions.push(li);
          break;
        case Category.EMPLOYER_CONTRIBUTION:
          breakdown.employerContributions.push(li);
          break;
        case Category.TAX:
          breakdown.taxes.push(li);
          break;
        case Category.EXEMPTION:
          breakdown.exemptions.push(li);
          break;
        case Category.INFO:
        default:
          // INFO lines (e.g. balancing entries, derived values) are not payslip buckets.
          break;
      }
    }
    return breakdown;
  }
}
