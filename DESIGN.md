# Payroll Tax Engine — Design Decisions, Requirements & NFRs

**Status:** LOCKED (decisions, product requirements, NFRs) · **Version:** 1.0 · **Date:** 2026-06-18
**Stack:** NestJS (modular monolith) · in-memory persistence behind repository interfaces (v1)

> This is the agreed baseline. Sections 1–9 are locked. Sections 10+ (Entities, APIs,
> DB Schema, System Design) get appended next and must not contradict anything below.

---

## 1. Product summary

A **multi-tenant payroll platform**, not a calculator. An employer buys the system,
onboards their company (picks one country), enrolls employees, and once a month runs
payroll with one action. For each employee the system computes the full breakdown for
the employer's country: earnings, employee deductions, employer contributions, statutory
taxes, net pay, and true cost to company — and persists an auditable payslip.

What makes it a *platform* and not a script: **tax logic is data**. Adding a country, a
regime, or a new tax year is a config change with golden tests, never a code release.

---

## 2. Actors

| Actor | Responsibility |
|---|---|
| **Employer / HR Admin** (tenant, the buyer) | Registers the company, manages employees, runs payroll, views payslips |
| **Employee** | Subject of payroll; v1 is employer-managed (self-service portal is future) |
| **Compliance / Rule Admin** (platform ops) | Authors and publishes country rulesets (rates, slabs, effective dates) |
| **Tax Engine** (system) | Computes the breakdown deterministically from the active ruleset |

---

## 3. Locked decisions (with rationale)

### 3.1 Architecture
| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Where tax logic lives | **Fully data-driven rule engine** (control flow in data) | Max flexibility; new country = config. Risk contained by D2–D5 |
| D2 | Rule ordering & dependencies | **Declared reads/writes + topological sort, validated at publish** | Makes "wrong order = silently wrong payslip" impossible to ship |
| D3 | Formula primitive evaluation | **Sandboxed, whitelisted expression evaluator** (CEL / JSONLogic) | Keeps flexibility, removes injection / runaway-cost / inner-platform risk |
| D4 | Past-period rule changes (arrears) | **Recompute with that period's ruleset, post arrears as an explicit diff** | Deterministic, auditable; issued payslips stay immutable |
| D5 | Rounding | **Per-ruleset config; default round-at-line + final balancing entry** | Rounding is country law; drift can never break the reconciliation sum |

**The four guardrails that make a fully data-driven engine safe** (say this in interview):
publish-time DAG validation (D2) · golden-test regression gate · sandboxed formula
evaluator (D3) · reconciliation invariant that refuses to emit a payslip that doesn't balance.

### 3.2 Product / domain
| # | Decision | Choice | Why |
|---|---|---|---|
| D6 | Product type | **Multi-tenant SaaS** (employer = tenant) | Real system: employers enroll, add employees, run payroll. Not a simulator |
| D7 | Country scope | **Single country per employer** (set at signup; employees inherit) | Simplest correct v1; multinational employer is a documented future change |
| D8 | India statutory coverage | **Full set** (both regimes) | Demonstrates employee + employer sides, conditional eligibility, progressive tax |
| D9 | Pay basis | **Both CTC and Gross, CTC primary** | Matches how Indian employers think; engine decomposes either |
| D10 | Persistence | **In-memory behind repository interfaces** (v1 timebox) | Real domain + flows now; Postgres later is a per-adapter swap (DIP), not a rewrite |
| D11 | Framework | **NestJS modular monolith**, bounded contexts | DI + module boundaries enforce SOLID and the engine's isolation |

---

## 4. Functional requirements

**Tenancy & identity**
- FR-1 Employer can register (company, country, currency) and authenticate.
- FR-2 Strict data isolation: an employer sees only its own employees, runs, payslips.

**Employee management**
- FR-3 Add / list / update / deactivate employees, scoped to the employer.
- FR-4 Employee carries: name, pay basis + amount, tax regime, declarations (rent, 80C, metro), status.

**Payroll calculation (engine)**
- FR-5 For an employee + period, compute the full breakdown for the employer's country/regime.
- FR-6 Cover employee-side deductions, employer-side contributions, and statutory taxes.
- FR-7 Return a structured breakdown, never just a final number.
- FR-8 Reconcile (lines sum to input) or refuse to emit.

**Payroll runs**
- FR-9 Employer runs payroll for a period across all active employees.
- FR-10 Persist a PayrollRun and one Payslip per employee; idempotent per (run, employee).

**Payslip & reporting**
- FR-11 View a payslip with line-item breakdown plus audit trace (which ruleset version produced it).

**Country & rule configuration**
- FR-12 Rulesets configurable per (country, regime, financial year), versioned and effective-dated.
- FR-13 Adding a country / regime / tax year is a config change, not a code release.

---

## 5. Non-functional requirements

**Dominance order:** Correctness → Auditability → Security/Tenancy → Extensibility →
Temporal correctness → (then the rest). Performance is **not** the hard constraint here.

| # | NFR (priority) | Measurable target | Tactic |
|---|---|---|---|
| NFR-1 | **Correctness & determinism** (P0) | Same (input, ruleset version) → identical output to the paisa; reconciliation holds on 100% of payslips; zero float errors | Decimal-only math; pure functional engine; round-at-line + balancing entry; reconcile-or-refuse |
| NFR-2 | **Auditability & traceability** (P0) | Every line traces to `ruleKey @ rulesetVersion`; any historical payslip reproducible byte-for-byte | Immutable payslips; `audit_trace` (input hash + version + ordered evaluations); immutable rulesets |
| NFR-3 | **Extensibility / configurability** (P0) | New country / regime / tax-year ships with **zero engine code change** (config + golden tests) | Data-driven engine; closed primitive catalog; OCP evaluator registry; rulesets as versioned data |
| NFR-4 | **Security & multi-tenancy** (P0) | Zero cross-tenant reads (passes IDOR suite); PII encrypted in transit + at rest; rule publish needs elevated role | `TenantGuard` scoping every query; `employerId` on every row; RBAC + audit on authoring |
| NFR-5 | **Temporal correctness / versioning** (P1) | Recompute of period P uses ruleset effective at P; issued payslips never mutate; arrears explicit | Effective-dated, immutable, versioned rulesets; pin version per run; recompute-and-diff |
| NFR-6 | **Reliability & idempotency** (P1) | 99.9% interactive availability; runs resumable; exactly-once per (run, employee); retries never double-pay | Stateless engine; idempotency key + `UNIQUE(run_id, employee_id)`; per-employee failure isolation |
| NFR-7 | **Predictability on bad input** (P1) | 100% of invalid/incomplete/duplicate inputs return a structured error; never a silent wrong payslip | DTO validation; explicit domain exceptions + global filter; reconciliation refuse; idempotency |
| NFR-8 | **Performance & scalability** (P2) | Interactive calc p99 < 200ms; 5k-employee run < 30s; engine scales horizontally | CPU-bound pure functions; compiled + cached rulesets/formulas; batch inserts; partitioned payslips; stateless pods |
| NFR-9 | **Maintainability & testability** (P2) | SOLID + bounded contexts; golden + property tests on every ruleset and primitive | Modular monolith; DIP at repos + engine facade; golden files travel with the ruleset |
| NFR-10 | **Durability & retention / compliance** (P2) | Payslips durable, retained per statute (India ~7 yrs); data residency (DPDP) honored | Append-only immutable payslip store; backups; region pinning |
| NFR-11 | **Observability** (P2) | Reconciliation-mismatch rate alerts immediately; a 3-week-old dispute reconstructable from storage | Metrics (mismatch / not-found rate, queue depth); structured logs; traces; `audit_trace` replay |

**Scale assumptions setting the targets:** thousands of employers, up to ~2M employees
aggregate; read-heavy on rulesets (cached, immutable), append-only payslip writes; monthly
batch concentrated at month-end (~1k calcs/sec peak). Modest → performance sits at P2.

**Key NFR tension:** Extensibility (NFR-3) threatens Correctness (NFR-1) by pushing logic
into data. Resolved by the four guardrails in §3.1. Flexibility is bought without paying
in correctness.

---

## 6. Scope

**In (v1 build):** employer onboarding, employee CRUD, payroll run, payslip breakdown,
India Old + New rulesets, the data-driven engine, the UI.

**Out (deferred, all behind clean seams):** billing/subscription, real DB, statutory
e-filing/returns, bank disbursement, employee self-service portal, multi-currency FX,
async batch queue, admin rule-authoring UI, multinational employer (D7).

---

## 7. Assumptions (locked)

- **Pay cycle:** monthly (India standard).
- **One active salary structure** per employee at a time.
- **Rulesets are seeded by platform ops**, not the employer.
- **Single currency per country.**
- **Professional Tax:** single state schedule per employer (state captured at signup,
  default Karnataka, ₹200/mo). PT is data in the ruleset → real per-state table is later config.
- **CTC → components (deterministic, no circular math):**
  `Basic = 50% of CTC` · employer contributions computed on Basic ·
  `Gross = CTC − employer contributions` · `Special = Gross − Basic − HRA`. Reconciles cleanly.

---

## 8. India v1 rule manifest (what the rulesets must contain)

```
EARNINGS (decomposition)
  Basic            = 50% of CTC base
  HRA              = 50% of Basic
  Special Allow.   = balancing figure (Gross − Basic − HRA)
EMPLOYER CONTRIBUTIONS
  Employer EPF     = 12% of Basic, wage ceiling ₹15,000
  Gratuity         = 4.81% of Basic
  Employer ESI     = 3.25% of Gross   (only if gross ≤ ₹21,000/mo)
EMPLOYEE DEDUCTIONS
  Employee EPF     = 12% of Basic, wage ceiling ₹15,000
  Employee ESI     = 0.75% of Gross   (only if gross ≤ ₹21,000/mo)
  Professional Tax = fixed ₹200/mo (state schedule)
  Income Tax (TDS) = SLAB → rebate 87A → surcharge (marginal relief) → cess 4%
EXEMPTIONS / DEDUCTIONS (regime-dependent)
  Standard deduction (both regimes)
  HRA exemption + 80C  (OLD regime only)
```
Two rulesets: `IN-OLD-2025-26`, `IN-NEW-2025-26`, both effective-dated.
(Rates/slabs illustrative for the example FY; they are data, not code.)

---

## 9. Requirements traceability

| Problem-statement requirement | Met by |
|---|---|
| Accept & process payroll input for a country | FR-3, FR-5; country from employer (D7) |
| Employee taxes, deductions, contributions | FR-6; engine employee-side rules |
| Employer contributions + total payroll cost | FR-6; engine employer-side rules + CTC aggregate |
| Structured breakdown, not just a number | FR-7, FR-11; Payslip + line items |
| Configurable country-specific rules | FR-12; data-driven rulesets |
| Extensible for new countries / rule changes | FR-13, NFR-3; OCP engine + versioned rulesets |
| Predictable on invalid/duplicate/odd input | FR-8, NFR-7; validation + idempotency + reconciliation refuse |

---

## 10. Pending sections (next, must honor §1–9)

- [ ] **Entities** (domain model + relationships)
- [ ] **APIs** (REST contract)
- [ ] **Database schema** (the eventual Postgres target behind the in-memory adapters)
- [ ] **System design** (modules, services, communication flow)
