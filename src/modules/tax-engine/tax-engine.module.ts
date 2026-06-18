import { Module } from '@nestjs/common';
import { TAX_ENGINE } from 'src/shared';
import { TaxEngineService } from './tax-engine.service';
import { ReconciliationService } from './reconciliation.service';
import { EvaluatorRegistry } from './evaluator-registry';
import { PercentageOfEvaluator } from './evaluators/percentage-of.evaluator';
import { FixedEvaluator } from './evaluators/fixed.evaluator';
import { SlabEvaluator } from './evaluators/slab.evaluator';
import { FormulaEvaluator } from './evaluators/formula.evaluator';
import { AggregateEvaluator } from './evaluators/aggregate.evaluator';
import { ExemptionEvaluator } from './evaluators/exemption.evaluator';

/**
 * TaxEngineModule — the pure, country-agnostic calculation core (D1–D5).
 *
 * Binds the concrete TaxEngineService to the TAX_ENGINE token and exports it so
 * other modules (Payroll) inject the interface, never the class. Each RuleType
 * evaluator is a provider, wired into the EvaluatorRegistry (OCP — NFR-3).
 */
@Module({
  providers: [
    PercentageOfEvaluator,
    FixedEvaluator,
    SlabEvaluator,
    FormulaEvaluator,
    AggregateEvaluator,
    ExemptionEvaluator,
    EvaluatorRegistry,
    ReconciliationService,
    TaxEngineService,
    { provide: TAX_ENGINE, useExisting: TaxEngineService },
  ],
  exports: [TAX_ENGINE, TaxEngineService],
})
export class TaxEngineModule {}
