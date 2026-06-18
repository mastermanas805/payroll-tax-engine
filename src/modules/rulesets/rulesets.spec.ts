import { InvalidRuleSetException, RuleSet, RuleType, Category } from 'src/shared';
import { InMemoryRulesetRepository } from './in-memory-ruleset.repository';
import { validateRuleSet } from './ruleset-validator';
import inOld from './data/in-old-2025-26.json';
import inNew from './data/in-new-2025-26.json';

describe('Ruleset validation', () => {
  it('IN-OLD-2025-26 passes publish-time validation', () => {
    expect(validateRuleSet(inOld as unknown as RuleSet)).toEqual([]);
  });

  it('IN-NEW-2025-26 passes publish-time validation', () => {
    expect(validateRuleSet(inNew as unknown as RuleSet)).toEqual([]);
  });

  it('catches a rate outside [0,1]', () => {
    const bad = JSON.parse(JSON.stringify(inOld)) as RuleSet;
    bad.rules.find((r) => r.key === 'BASIC')!.params.rate = 1.5;
    const issues = validateRuleSet(bad);
    expect(issues.some((i) => i.code === 'RATE_OUT_OF_RANGE')).toBe(true);
  });

  it('catches a SLAB gap', () => {
    const bad = JSON.parse(JSON.stringify(inNew)) as RuleSet;
    bad.rules.find((r) => r.key === 'INCOME_TAX')!.params.brackets[1].from = 350000;
    const issues = validateRuleSet(bad);
    expect(issues.some((i) => i.code === 'SLAB_GAP' || i.code === 'SLAB_OVERLAP')).toBe(true);
  });

  it('catches an unsatisfied read', () => {
    const bad = JSON.parse(JSON.stringify(inNew)) as RuleSet;
    bad.rules.find((r) => r.key === 'NET')!.reads.push('component:NONEXISTENT');
    const issues = validateRuleSet(bad);
    expect(issues.some((i) => i.code === 'UNSATISFIED_READ')).toBe(true);
  });

  it('catches a dependency cycle', () => {
    const bad = JSON.parse(JSON.stringify(inNew)) as RuleSet;
    // Make BASIC read GROSS, which (transitively) reads BASIC -> cycle.
    bad.rules.find((r) => r.key === 'BASIC')!.reads.push('component:GROSS');
    const issues = validateRuleSet(bad);
    expect(issues.some((i) => i.code === 'DAG_CYCLE')).toBe(true);
  });
});

describe('InMemoryRulesetRepository', () => {
  let repo: InMemoryRulesetRepository;

  beforeEach(() => {
    repo = new InMemoryRulesetRepository();
  });

  it('loads both seed rulesets at construction', () => {
    expect(repo.list()).toHaveLength(2);
    expect(repo.findById('IN-OLD-2025-26')).not.toBeNull();
    expect(repo.findById('IN-NEW-2025-26')).not.toBeNull();
  });

  it('resolves the published ruleset whose window covers the period', () => {
    const old = repo.resolve('IN', 'OLD', '2025-07');
    expect(old?.id).toBe('IN-OLD-2025-26');
    const neu = repo.resolve('IN', 'NEW', '2026-03');
    expect(neu?.id).toBe('IN-NEW-2025-26');
  });

  it('returns null outside the effective window or for unknown country/regime', () => {
    expect(repo.resolve('IN', 'OLD', '2024-12')).toBeNull();
    expect(repo.resolve('IN', 'OLD', '2026-04')).toBeNull();
    expect(repo.resolve('US', 'OLD', '2025-07')).toBeNull();
    expect(repo.resolve('IN', 'BOGUS', '2025-07')).toBeNull();
  });

  it('rejects an invalid ruleset on save', () => {
    const bad = JSON.parse(JSON.stringify(inOld)) as RuleSet;
    bad.id = 'IN-OLD-BROKEN';
    bad.rules.find((r) => r.key === 'GRATUITY')!.params.rate = 2;
    expect(() => repo.save(bad)).toThrow(InvalidRuleSetException);
    expect(repo.findById('IN-OLD-BROKEN')).toBeNull();
  });

  it('rule ordering is topologically valid: BASIC before employer EPF before GROSS before SPECIAL', () => {
    const rs = repo.findById('IN-OLD-2025-26')!;
    const idx = (key: string) => rs.rules.findIndex((r) => r.writes === key);
    expect(idx('component:BASIC')).toBeLessThan(idx('employer:EPF'));
    expect(idx('employer:EPF')).toBeLessThan(idx('component:GROSS'));
    expect(idx('component:GROSS')).toBeLessThan(idx('component:SPECIAL'));
  });

  it('ESI eligibility reads component:GROSS', () => {
    const rs = repo.findById('IN-OLD-2025-26')!;
    const esi = rs.rules.find((r) => r.key === 'EMPLOYER_ESI')!;
    expect(esi.reads).toContain('component:GROSS');
    expect(esi.condition).toBeDefined();
  });

  it('OLD regime has HRA exemption and 80C; NEW regime does not', () => {
    const old = repo.findById('IN-OLD-2025-26')!;
    const neu = repo.findById('IN-NEW-2025-26')!;
    expect(old.rules.some((r) => r.writes === 'exemption:HRA')).toBe(true);
    expect(old.rules.some((r) => r.writes === 'exemption:80C')).toBe(true);
    expect(neu.rules.some((r) => r.writes === 'exemption:HRA')).toBe(false);
    expect(neu.rules.some((r) => r.writes === 'exemption:80C')).toBe(false);
  });

  it('income tax SLAB declares the engine post-processors', () => {
    const rs = repo.findById('IN-NEW-2025-26')!;
    const tax = rs.rules.find((r) => r.type === RuleType.SLAB)!;
    expect(tax.category).toBe(Category.TAX);
    expect(tax.params.postProcessors).toEqual(['REBATE_87A', 'SURCHARGE', 'CESS_4PCT']);
  });
});
