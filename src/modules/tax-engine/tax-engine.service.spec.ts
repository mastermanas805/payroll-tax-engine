import { Test } from '@nestjs/testing';
import {
  RuleSet,
  Rule,
  RuleType,
  Category,
  RoundingConfig,
  CalculationInput,
  InvalidRuleSetException,
  ReconciliationException,
} from 'src/shared';
import { TaxEngineModule } from './tax-engine.module';
import { TaxEngineService } from './tax-engine.service';

const ROUNDING: RoundingConfig = { unit: 1, strategy: 'HALF_UP' };

function input(amount: number, type: 'CTC' | 'GROSS' = 'CTC'): CalculationInput {
  return {
    payBasis: { type, amount },
    declarations: {},
    period: '2025-06',
    regime: 'NEW',
  };
}

/**
 * Small CTC-decomposition ruleset mirroring DESIGN §7/§8 (employer side only),
 * used as the golden + structural fixture.
 *
 *   Basic   = 50% of CTC
 *   HRA     = 50% of Basic
 *   ER EPF  = 12% of min(Basic, 15000)
 *   Gratuity= 4.81% of Basic
 *   ER cost = EPF + Gratuity
 *   Gross   = CTC - ER cost          (FORMULA)
 *   Special = Gross - Basic - HRA    (FORMULA, balancing figure)
 */
function decompositionRules(): Rule[] {
  return [
    {
      key: 'BASIC',
      type: RuleType.PERCENTAGE_OF,
      category: Category.EARNING,
      reads: ['input:CTC'],
      writes: 'component:BASIC',
      params: { rate: 0.5, base: 'input:CTC' },
      label: 'Basic',
    },
    {
      key: 'HRA',
      type: RuleType.PERCENTAGE_OF,
      category: Category.EARNING,
      reads: ['component:BASIC'],
      writes: 'component:HRA',
      params: { rate: 0.5, base: 'component:BASIC' },
      label: 'HRA',
    },
    {
      key: 'ER_EPF',
      type: RuleType.PERCENTAGE_OF,
      category: Category.EMPLOYER_CONTRIBUTION,
      reads: ['component:BASIC'],
      writes: 'employer:EPF',
      params: { rate: 0.12, base: 'component:BASIC', cap: { kind: 'BASE_CEILING', value: 15000 } },
      label: 'Employer EPF',
    },
    {
      key: 'GRATUITY',
      type: RuleType.PERCENTAGE_OF,
      category: Category.EMPLOYER_CONTRIBUTION,
      reads: ['component:BASIC'],
      writes: 'employer:GRATUITY',
      params: { rate: 0.0481, base: 'component:BASIC' },
      label: 'Gratuity',
    },
    {
      key: 'ER_COST',
      type: RuleType.AGGREGATE,
      category: Category.INFO,
      reads: ['employer:EPF', 'employer:GRATUITY'],
      writes: 'derived:EMPLOYER_COST',
      params: {},
      label: 'Employer cost',
    },
    {
      key: 'GROSS',
      type: RuleType.FORMULA,
      category: Category.INFO,
      reads: ['input:CTC', 'derived:EMPLOYER_COST'],
      writes: 'component:GROSS',
      params: { expr: { '-': [{ var: 'input:CTC' }, { var: 'derived:EMPLOYER_COST' }] } },
      label: 'Gross',
    },
    {
      key: 'SPECIAL',
      type: RuleType.FORMULA,
      category: Category.EARNING,
      reads: ['component:GROSS', 'component:BASIC', 'component:HRA'],
      writes: 'component:SPECIAL',
      params: {
        expr: {
          '-': [
            { '-': [{ var: 'component:GROSS' }, { var: 'component:BASIC' }] },
            { var: 'component:HRA' },
          ],
        },
      },
      label: 'Special Allowance',
    },
  ];
}

function ruleSet(rules: Rule[]): RuleSet {
  return {
    id: 'IN-TEST-2025-26',
    country: 'IN',
    regime: 'NEW',
    financialYear: '2025-26',
    effectiveFrom: '2025-04-01',
    effectiveTo: null,
    version: 1,
    status: 'PUBLISHED',
    currency: 'INR',
    rounding: ROUNDING,
    rules,
  };
}

describe('TaxEngineService', () => {
  let engine: TaxEngineService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TaxEngineModule],
    }).compile();
    engine = moduleRef.get(TaxEngineService);
  });

  describe('golden — CTC decomposition reconciles to the paisa', () => {
    it('produces the asserted breakdown for CTC 100000', () => {
      const result = engine.calculate(ruleSet(decompositionRules()), input(100000));

      // Earnings: Basic 50000, HRA 25000, Special = Gross - 75000.
      // ER EPF = 12% of 15000 = 1800 ; Gratuity = 4.81% of 50000 = 2405.
      // ER cost = 4205 ; Gross = 100000 - 4205 = 95795 ; Special = 95795 - 75000 = 20795.
      const byKey = (arr: { ruleKey: string; amount: number }[]) =>
        Object.fromEntries(arr.map((li) => [li.ruleKey, li.amount]));

      const earnings = byKey(result.breakdown.earnings);
      expect(earnings['BASIC']).toBe(50000);
      expect(earnings['HRA']).toBe(25000);
      expect(earnings['SPECIAL']).toBe(20795);

      const employer = byKey(result.breakdown.employerContributions);
      expect(employer['ER_EPF']).toBe(1800);
      expect(employer['GRATUITY']).toBe(2405);

      expect(result.summary.gross).toBe(95795);
      expect(result.summary.netPay).toBe(95795); // no employee deductions/taxes here
      expect(result.summary.totalEmployerCost).toBe(95795 + 4205);
      expect(result.summary.ctc).toBe(100000);

      expect(result.rulesetVersion).toBe('IN-TEST-2025-26@1');
      expect(result.traceId).toMatch(/[0-9a-f-]{36}/);
    });

    it('earnings sum exactly to gross (reconciliation invariant)', () => {
      const result = engine.calculate(ruleSet(decompositionRules()), input(100000));
      const earningsSum = result.breakdown.earnings.reduce((a, li) => a + li.amount, 0);
      expect(earningsSum).toBe(result.summary.gross);
    });
  });

  describe('eligibility (condition) — ESI-style skip', () => {
    const esiRules = (): Rule[] => [
      ...decompositionRules(),
      {
        key: 'EE_ESI',
        type: RuleType.PERCENTAGE_OF,
        category: Category.EMPLOYEE_DEDUCTION,
        reads: ['component:GROSS'],
        writes: 'deduction:ESI',
        // only when gross <= 21000
        condition: { '<=': [{ var: 'component:GROSS' }, 21000] },
        params: { rate: 0.0075, base: 'component:GROSS' },
        label: 'Employee ESI',
      },
    ];

    it('skips ESI when gross exceeds the ceiling', () => {
      const result = engine.calculate(ruleSet(esiRules()), input(100000));
      const esi = result.breakdown.employeeDeductions.find((li) => li.ruleKey === 'EE_ESI');
      expect(esi).toBeUndefined();
      expect(result.summary.totalEmployeeDeductions).toBe(0);
    });

    it('applies ESI for a low-gross employee', () => {
      // GROSS basis 20000 directly so the formula chain is bypassed.
      const lowRules: Rule[] = [
        {
          key: 'GROSS_PASSTHROUGH',
          type: RuleType.FORMULA,
          category: Category.EARNING,
          reads: ['input:GROSS'],
          writes: 'component:GROSS',
          params: { expr: { var: 'input:GROSS' } },
          label: 'Gross',
        },
        {
          key: 'EE_ESI',
          type: RuleType.PERCENTAGE_OF,
          category: Category.EMPLOYEE_DEDUCTION,
          reads: ['component:GROSS'],
          writes: 'deduction:ESI',
          condition: { '<=': [{ var: 'component:GROSS' }, 21000] },
          params: { rate: 0.0075, base: 'component:GROSS' },
          label: 'Employee ESI',
        },
      ];
      const result = engine.calculate(ruleSet(lowRules), input(20000, 'GROSS'));
      const esi = result.breakdown.employeeDeductions.find((li) => li.ruleKey === 'EE_ESI');
      expect(esi?.amount).toBe(150); // 0.75% of 20000
      expect(result.summary.netPay).toBe(20000 - 150);
    });
  });

  describe('topological validation (D2)', () => {
    it('throws on an unsatisfied dependency', () => {
      const rules: Rule[] = [
        {
          key: 'X',
          type: RuleType.FORMULA,
          category: Category.EARNING,
          reads: ['component:DOES_NOT_EXIST'],
          writes: 'component:GROSS',
          params: { expr: { var: 'component:DOES_NOT_EXIST' } },
          label: 'X',
        },
      ];
      expect(() => engine.calculate(ruleSet(rules), input(1000))).toThrow(InvalidRuleSetException);
    });

    it('throws on a dependency cycle', () => {
      const rules: Rule[] = [
        {
          key: 'A',
          type: RuleType.FORMULA,
          category: Category.EARNING,
          reads: ['component:HRA'],
          writes: 'component:BASIC',
          params: { expr: { var: 'component:HRA' } },
          label: 'A',
        },
        {
          key: 'B',
          type: RuleType.FORMULA,
          category: Category.EARNING,
          reads: ['component:BASIC'],
          writes: 'component:HRA',
          params: { expr: { var: 'component:BASIC' } },
          label: 'B',
        },
      ];
      expect(() => engine.calculate(ruleSet(rules), input(1000))).toThrow(InvalidRuleSetException);
    });

    it('orders rules regardless of declaration order', () => {
      // Reverse the natural order; topo sort must still compute correctly.
      const reversed = [...decompositionRules()].reverse();
      const result = engine.calculate(ruleSet(reversed), input(100000));
      expect(result.summary.gross).toBe(95795);
    });
  });

  describe('reconciliation refuses material drift', () => {
    it('throws ReconciliationException when earnings do not sum to gross', () => {
      const rules: Rule[] = [
        {
          key: 'GROSS',
          type: RuleType.FIXED,
          category: Category.INFO,
          reads: [],
          writes: 'component:GROSS',
          params: { amount: 100000 },
          label: 'Gross',
        },
        {
          key: 'BASIC',
          type: RuleType.FIXED,
          category: Category.EARNING,
          reads: [],
          writes: 'component:BASIC',
          params: { amount: 50000 }, // earnings sum 50000 != gross 100000 -> material drift
          label: 'Basic',
        },
      ];
      expect(() => engine.calculate(ruleSet(rules), input(100000))).toThrow(ReconciliationException);
    });

    it('adds a balancing INFO line for sub-unit drift', () => {
      // Use rupee rounding; build a 1-rupee drift that is within unit.
      const rules: Rule[] = [
        {
          key: 'GROSS',
          type: RuleType.FIXED,
          category: Category.INFO,
          reads: [],
          writes: 'component:GROSS',
          params: { amount: 1001 },
          label: 'Gross',
        },
        {
          key: 'EARN',
          type: RuleType.FIXED,
          category: Category.EARNING,
          reads: [],
          writes: 'component:BASIC',
          params: { amount: 1000 }, // drift 1 == unit -> balancing line, not a throw
          label: 'Earning',
        },
      ];
      const result = engine.calculate(ruleSet(rules), input(1001));
      expect(result.summary.gross).toBe(1001);
      const earningsSum = result.breakdown.earnings.reduce((a, li) => a + li.amount, 0);
      expect(earningsSum).toBe(1000); // balancing line is INFO, excluded from earnings bucket
    });
  });

  describe('SLAB progressive tax + post-processors', () => {
    const slabRuleSet = (): RuleSet =>
      ruleSet([
        {
          key: 'TAXABLE',
          type: RuleType.FORMULA,
          category: Category.INFO,
          reads: ['input:GROSS'],
          writes: 'derived:TAXABLE_INCOME',
          params: { expr: { var: 'input:GROSS' } },
          label: 'Taxable income',
        },
        {
          key: 'GROSS',
          type: RuleType.FORMULA,
          category: Category.EARNING,
          reads: ['input:GROSS'],
          writes: 'component:GROSS',
          params: { expr: { var: 'input:GROSS' } },
          label: 'Gross',
        },
        {
          key: 'TDS',
          type: RuleType.SLAB,
          category: Category.TAX,
          reads: ['derived:TAXABLE_INCOME'],
          writes: 'tax:TDS',
          params: {
            base: 'derived:TAXABLE_INCOME',
            brackets: [
              { from: 0, to: 300000, rate: 0 },
              { from: 300000, to: 700000, rate: 0.05 },
              { from: 700000, to: 1000000, rate: 0.1 },
              { from: 1000000, to: null, rate: 0.2 },
            ],
            postProcessors: [{ kind: 'CESS_4PCT' }],
          },
          label: 'Income Tax (TDS)',
        },
      ]);

    it('computes progressive tax with 4% cess', () => {
      // taxable 1,200,000:
      //  0-300k: 0 ; 300k-700k @5% = 20000 ; 700k-1m @10% = 30000 ;
      //  1m-1.2m @20% = 40000 ; base tax = 90000 ; +4% cess = 93600.
      const result = engine.calculate(slabRuleSet(), input(1200000, 'GROSS'));
      const tds = result.breakdown.taxes.find((li) => li.ruleKey === 'TDS');
      expect(tds?.amount).toBe(93600);
    });

    it('rebate 87A zeroes tax under the limit', () => {
      const rs = ruleSet([
        {
          key: 'TAXABLE',
          type: RuleType.FORMULA,
          category: Category.INFO,
          reads: ['input:GROSS'],
          writes: 'derived:TAXABLE_INCOME',
          params: { expr: { var: 'input:GROSS' } },
          label: 'Taxable',
        },
        {
          key: 'GROSS',
          type: RuleType.FORMULA,
          category: Category.EARNING,
          reads: ['input:GROSS'],
          writes: 'component:GROSS',
          params: { expr: { var: 'input:GROSS' } },
          label: 'Gross',
        },
        {
          key: 'TDS',
          type: RuleType.SLAB,
          category: Category.TAX,
          reads: ['derived:TAXABLE_INCOME'],
          writes: 'tax:TDS',
          params: {
            base: 'derived:TAXABLE_INCOME',
            brackets: [
              { from: 0, to: 300000, rate: 0 },
              { from: 300000, to: 700000, rate: 0.05 },
              { from: 700000, to: null, rate: 0.1 },
            ],
            postProcessors: [
              { kind: 'REBATE_87A', limit: 700000, maxRebate: 25000 },
              { kind: 'CESS_4PCT' },
            ],
          },
          label: 'TDS',
        },
      ]);
      // taxable 600000 <= 700000 ; base tax = 5% of 300000 = 15000 ; rebate caps -> 0.
      const result = engine.calculate(rs, input(600000, 'GROSS'));
      const tds = result.breakdown.taxes.find((li) => li.ruleKey === 'TDS');
      expect(tds?.amount).toBe(0);
    });

    // PROPERTY: slab tax is monotonic non-decreasing in taxable income.
    it('property — slab tax is monotonic in income', () => {
      const rs = slabRuleSet();
      let previous = -1;
      for (let income = 0; income <= 2_000_000; income += 25_000) {
        const result = engine.calculate(rs, input(income, 'GROSS'));
        const tds = result.breakdown.taxes.find((li) => li.ruleKey === 'TDS')?.amount ?? 0;
        expect(tds).toBeGreaterThanOrEqual(previous);
        previous = tds;
      }
    });
  });

  describe('property — reconciliation holds across random CTCs', () => {
    it('netPay = gross - deductions - taxes, ctc = gross + employer for many inputs', () => {
      const rs = ruleSet(decompositionRules());
      for (let i = 0; i < 200; i++) {
        const amount = Math.round((50_000 + Math.random() * 950_000));
        const result = engine.calculate(rs, input(amount));

        const earningsSum = result.breakdown.earnings.reduce((a, li) => a + li.amount, 0);
        const employerSum = result.breakdown.employerContributions.reduce(
          (a, li) => a + li.amount,
          0,
        );
        const deductionsSum = result.breakdown.employeeDeductions.reduce(
          (a, li) => a + li.amount,
          0,
        );
        const taxSum = result.breakdown.taxes.reduce((a, li) => a + li.amount, 0);

        // Within one rounding unit (rupee) — round-at-line tolerance.
        expect(Math.abs(earningsSum - result.summary.gross)).toBeLessThanOrEqual(1);
        expect(result.summary.netPay).toBeCloseTo(
          result.summary.gross - deductionsSum - taxSum,
          6,
        );
        expect(result.summary.totalEmployerCost).toBeCloseTo(
          result.summary.gross + employerSum,
          6,
        );
        expect(result.summary.ctc).toBe(result.summary.totalEmployerCost);
      }
    });
  });
});
