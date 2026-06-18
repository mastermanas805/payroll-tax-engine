# Payroll Tax Engine

A **multi-tenant payroll platform** with an **extensible, data-driven tax engine**. An
employer signs up (one country), enrolls employees, and runs payroll once a month — the
system computes each employee's full breakdown (earnings, employee deductions, employer
contributions, statutory taxes, net pay, true cost to company) and persists an auditable
payslip.

The core idea: **tax logic is data, not code.** A country's rules live as versioned,
effective-dated *rulesets* that a generic engine interprets. Adding a country, a regime,
or a new tax year is a config change with tests — not a code release.

> Full design rationale, decisions (D1–D11), NFRs, API contract, DB schema, and end-to-end
> scenarios are in **[DESIGN.md](./DESIGN.md)**. Operational run notes are in **[RUN.md](./RUN.md)**.

---

## Highlights

- **Data-driven rule engine** — rules are typed primitives (`PERCENTAGE_OF`, `FIXED`,
  `SLAB`, `FORMULA`, `AGGREGATE`, `EXEMPTION`) ordered by a **topological sort** of their
  declared `reads`/`writes`, evaluated into a shared context, with **reconcile-or-refuse**
  (a payslip that doesn't balance is never emitted).
- **Sandboxed conditions/formulas** via JsonLogic (no `eval`) — e.g. ESI eligibility, HRA exemption.
- **Multi-tenant** — every record is scoped to the employer; the tenant is derived from the
  JWT, never from the request body (no cross-tenant access).
- **India, both regimes** — Old & New, with EPF (wage-capped), ESI (conditional), Professional
  Tax, Gratuity, Standard Deduction, HRA exemption / 80C (Old), and progressive income tax
  (slabs → 87A rebate → surcharge w/ marginal relief → 4% cess).
- **SOLID / DIP** — services depend on interfaces; in-memory repositories now, a real DB later
  is a per-adapter swap with no change to the engine, controllers, or UI.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | NestJS 10 (modular monolith), TypeScript, decimal.js, JsonLogic, JWT (bcryptjs) |
| Frontend | Vite + React + TypeScript (SPA, served statically by the backend) |
| Persistence | In-memory repositories behind interfaces (v1) |

---

## Prerequisites

- **Node 18+** (developed/tested on Node 26)
- npm

## Quick start

```bash
git clone https://github.com/mastermanas805/payroll-tax-engine.git
cd payroll-tax-engine

# 1. backend deps + build
npm install
npm run build

# 2. frontend deps + build (the built SPA is served by the backend at /)
cd client && npm install && npm run build && cd ..

# 3. run — API + UI on http://localhost:3000
npm run start:prod
```

Open **http://localhost:3000** and log in with the seeded demo account below.
Set `PORT` to override the port.

### Dev mode (hot reload)

```bash
# terminal 1 — backend (watch) on :3000
npm run start:dev

# terminal 2 — Vite dev server on :5173 (proxies /api -> :3000)
cd client && npm run dev
```

---

## Seed data (automatic, idempotent)

On every boot the app seeds a demo tenant so the UI has data immediately. There is **no
separate seed command** — it runs on application bootstrap and skips if the demo employer
already exists. The two India rulesets self-load in the rulesets repository at construction.

**Demo login**

| | |
|---|---|
| Email | `hr@acme.in` |
| Password | `password` |
| Company | Acme India Pvt Ltd (country IN, currency INR, state KA) |

**Seeded employees** (`payBasis.amount` is the **annual** CTC; the engine normalizes to a
monthly pay cycle internally):

| Name | Annual CTC | Regime | Declarations |
|---|---|---|---|
| Priya Sharma | ₹18,00,000 | NEW | — |
| Rahul Verma | ₹12,00,000 | OLD | rent ₹2,40,000, 80C ₹1,50,000, metro |
| Anita Desai | ₹6,00,000 | NEW | — |

**Seeded rulesets:** `IN-NEW-2025-26`, `IN-OLD-2025-26` (FY 2025-26), effective-dated and
open-ended so current periods resolve.

---

## Try it (API)

All endpoints are under `/api/v1`. Auth returns `{ accessToken, employer }`; send
`Authorization: Bearer <accessToken>` on every authenticated call.

```bash
BASE=http://localhost:3000/api/v1

# login as the demo employer
TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"hr@acme.in","password":"password"}' \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).accessToken))')

# run payroll for a month (any YYYY-MM from 2025-04 onward resolves)
curl -s -X POST $BASE/payroll/runs \
  -H "Authorization: Bearer $TOKEN" -H 'Idempotency-Key: demo-1' \
  -H 'Content-Type: application/json' -d '{"period":"2026-06"}'
```

**Sample monthly payslip** (Priya, ₹18L/yr CTC, New regime):

| Line | Monthly ₹ |
|---|---|
| Basic / HRA / Special | 75,000 / 37,500 / 32,092 |
| **Gross** | **1,44,592** |
| Employee EPF / Professional Tax | 1,800 / 200 |
| Income Tax (TDS) | 16,296 |
| **Net pay** | **1,26,296** |
| Employer EPF / Gratuity | 1,800 / 3,608 |
| **Cost to company** | **1,50,000** |

Every payslip satisfies: `earnings == gross`, `gross + employer contributions == CTC`,
`gross − deductions − tax == net`.

### Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` · `/auth/login` | onboard / authenticate an employer |
| GET | `/me` | current tenant profile |
| POST/GET/PATCH/DELETE | `/employees[/:id]` | tenant-scoped employee management |
| POST | `/payroll/calculate` | ad-hoc breakdown preview (no persist) |
| POST | `/payroll/runs` | run a period (`Idempotency-Key` replays) |
| GET | `/payroll/runs[/:id][/payslips]` | run history & payslips |
| GET | `/payslips/:id` | full reconciled breakdown + trace |

Full endpoint notes: **[RUN.md](./RUN.md)**.

---

## Adding a new country (the extensibility story)

No engine code changes — it's config + tests:

1. Author a ruleset (JSON) for the country/regime/FY using the primitive catalog, with
   correct `reads`/`writes` so the engine topo-sorts it.
2. Add golden test cases (known input → expected payslip).
3. Validate (DAG acyclic, slabs cover the range, rates in 0..1) and publish.

The engine, controllers, DB schema, APIs, and UI are untouched. See the "Introduce a new
country" scenario in **[DESIGN.md](./DESIGN.md)**.

## Tests

```bash
npm test                          # full Jest suite
npx jest src/modules/tax-engine   # one module (engine golden/property tests)
```

## Project structure

```
src/
  shared/                 # frozen kernel: types, contracts (interfaces + DI tokens),
                          #   CalculationContext, money helpers, exceptions, tenancy guard
  modules/
    tax-engine/           # topo-sort engine, 6 evaluators, reconciliation, rounding
    rulesets/             # in-memory ruleset repo + IN-OLD/IN-NEW JSON + validator
    identity/             # employer auth (JWT + bcrypt), TenantGuard
    employees/            # tenant-scoped employee CRUD
    payroll/              # run orchestration, idempotency, immutable payslips
    seed/                 # demo data on bootstrap
client/                   # Vite + React SPA (served from client/dist at /)
DESIGN.md                 # decisions, NFRs, API/DB design, scenarios
RUN.md                    # detailed run notes
```

## v1 notes & limitations

- **In-memory persistence** — all data resets on restart (then the demo tenant re-seeds).
  Repositories sit behind interfaces, so a real DB (Postgres/SQLite) is a contained swap.
- **Single country per employer** — set at signup; a multinational employer is a future change.
- **Illustrative FY2025-26 tax figures** — slabs/rates are representative for the example;
  they are data, so updating them is a ruleset edit, not code.
- **Minimal auth** for the demo (no refresh tokens / RBAC beyond tenant scoping).
