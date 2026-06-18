/**
 * Domain exceptions (NFR-7: predictable structured errors, never a silent wrong payslip).
 *
 * Each carries a stable `code`, an HTTP `status`, and optional `details`. The
 * DomainExceptionFilter maps them to the { error: { code, message, details } } envelope.
 */
export abstract class DomainException extends Error {
  /** stable machine-readable error code. */
  abstract readonly code: string;
  /** HTTP status to emit. */
  abstract readonly status: number;
  /** optional structured context (ids, mismatched sums, validation issues). */
  readonly details?: unknown;

  protected constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/** No PUBLISHED ruleset effective for (country, regime, period). */
export class RulesetNotFoundException extends DomainException {
  readonly code = 'RULESET_NOT_FOUND';
  readonly status = 404;
  constructor(message = 'No effective ruleset found', details?: unknown) {
    super(message, details);
  }
}

/** A computed payslip failed the reconciliation invariant (FR-8). 422. */
export class ReconciliationException extends DomainException {
  readonly code = 'RECONCILIATION_FAILED';
  readonly status = 422;
  constructor(message = 'Payslip failed to reconcile', details?: unknown) {
    super(message, details);
  }
}

/** A ruleset failed publish-time validation (DAG cycle, unknown read, etc. — D2). 422. */
export class InvalidRuleSetException extends DomainException {
  readonly code = 'INVALID_RULESET';
  readonly status = 422;
  constructor(message = 'Ruleset is invalid', details?: unknown) {
    super(message, details);
  }
}

/** Input failed domain validation (bad period, missing declaration, etc.). 400. */
export class InvalidInputException extends DomainException {
  readonly code = 'INVALID_INPUT';
  readonly status = 400;
  constructor(message = 'Invalid input', details?: unknown) {
    super(message, details);
  }
}

/** A payroll run already exists for (employer, period) (idempotency — NFR-6). 409. */
export class DuplicateRunException extends DomainException {
  readonly code = 'DUPLICATE_RUN';
  readonly status = 409;
  constructor(message = 'A payroll run already exists for this period', details?: unknown) {
    super(message, details);
  }
}

/** Cross-tenant access attempt (IDOR) (NFR-4). 403. */
export class TenantViolationException extends DomainException {
  readonly code = 'TENANT_VIOLATION';
  readonly status = 403;
  constructor(message = 'Access denied for this tenant', details?: unknown) {
    super(message, details);
  }
}
