/**
 * Canonical JWT claim shape. Identity signs this (same secret/module via SharedModule);
 * TenantGuard verifies it and projects employerId + role onto the request.
 */
export interface JwtPayload {
  /** subject = employer id (the tenant). */
  sub: string;
  /** employer email (convenience). */
  email?: string;
  /** RBAC role; 'rule_admin' gates ruleset publishing (NFR-4). */
  role: string;
}

/** The shape TenantGuard attaches to the Express request. */
export interface TenantRequest {
  employerId: string;
  role: string;
  user?: JwtPayload;
}
