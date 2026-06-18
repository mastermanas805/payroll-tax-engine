/**
 * Dependency-Injection tokens (the frozen wiring contract).
 *
 * Each repository / service is bound to one of these string-const tokens.
 * Concrete (in-memory v1) implementations live in feature modules; they bind
 * their class to the matching token here and EXPORT it from their Nest module
 * so other modules can `@Inject(<TOKEN>)` the interface, never the class.
 *
 * Using `as const` gives each token a literal type so typos are caught.
 */
export const EMPLOYER_REPOSITORY = 'EMPLOYER_REPOSITORY' as const;
export const EMPLOYEE_REPOSITORY = 'EMPLOYEE_REPOSITORY' as const;
export const PAYROLL_RUN_REPOSITORY = 'PAYROLL_RUN_REPOSITORY' as const;
export const PAYSLIP_REPOSITORY = 'PAYSLIP_REPOSITORY' as const;
export const RULESET_REPOSITORY = 'RULESET_REPOSITORY' as const;
export const TAX_ENGINE = 'TAX_ENGINE' as const;
