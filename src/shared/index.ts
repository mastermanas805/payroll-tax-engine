/**
 * Top-level barrel for the shared kernel. Downstream agents may import from
 * 'src/shared' or from the specific sub-barrels (contracts, types, tenancy, ...).
 */
export * from './contracts';
export * from './types';
export * from './exceptions';
export * from './tenancy';
export * from './money/money';
export * from './engine/calculation-context';
export * from './shared.module';
