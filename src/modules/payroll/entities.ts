/**
 * Payroll-owned entities (FR-9..FR-11). The canonical shapes are FROZEN in the
 * shared kernel (src/shared/types/domain.types + breakdown.types); this barrel
 * re-exports them under payroll-local names so the module reads against one
 * place and so PayslipLineItem explicitly reuses the shared LineItem.
 */
export type {
  PayrollRun,
  PayrollRunStatus,
  Payslip,
} from 'src/shared/types/domain.types';

export type {
  Breakdown,
  LineItem as PayslipLineItem,
  PayrollSummary,
  CalculationResult,
} from 'src/shared/types/breakdown.types';
