# Running the Payroll Tax Engine

Multi-tenant, data-driven payroll tax engine (NestJS modular monolith + React SPA).
Persistence is in-memory — all data resets on restart, then a demo tenant is re-seeded.

## Prerequisites

- Node 18+ (tested on Node 26)
- Dependencies are already installed at the repo root and in `client/`.

## Start (production: API + built SPA on one port)

```bash
# from the repo root
npm run build         # compiles the NestJS server to dist/
npm run start:prod    # node dist/main — listens on :3000
```

Then open http://localhost:3000 — the built SPA (`client/dist`) is served at `/`
by `ServeStaticModule`; the REST API lives under `/api/v1` (excluded from the
static handler). Set `PORT` to override the port.

If `client/dist` is missing, build the SPA first:

```bash
cd client && npm install && npm run build
```

## Develop the UI with hot reload (optional)

```bash
cd client
npm run dev           # Vite dev server on :5173, proxies /api -> http://localhost:3000
```

Run the server (`npm run start:dev` at root) alongside it.

## Demo credentials

A demo employer is seeded on every boot (idempotent):

- **Email:** `hr@acme.in`
- **Password:** `password`
- Company "Acme India Pvt Ltd" (country IN, currency INR) with 3 active
  employees (NEW and OLD regimes) so the UI has data immediately.

The two India rulesets (`IN-NEW-2025-26`, `IN-OLD-2025-26`, FY 2025-26) self-load
in the rulesets repository at construction — no separate seeding step.

## Key endpoints (all under `/api/v1`)

Auth responses are `{ accessToken, employer }`. Send the token as
`Authorization: Bearer <accessToken>` on every authenticated call. The tenant
(employerId) is always derived from the JWT — never from the request body.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | `{ companyName, email, password, country }` → 201, `{ accessToken, employer }` |
| POST | `/auth/login` | `{ email, password }` → 200, `{ accessToken, employer }` |
| GET  | `/me` | current tenant profile (TenantGuard) |
| POST | `/employees` | create employee (`name`, `payBasis{type,amount}`, `regime`, `declarations?`) |
| GET  | `/employees` | list (`?activeOnly=true` supported) |
| GET  | `/employees/:id` | one employee |
| PATCH| `/employees/:id` | partial update |
| DELETE| `/employees/:id` | soft-deactivate |
| POST | `/payroll/calculate` | ad-hoc preview, persists nothing |
| POST | `/payroll/runs` | run a period; `Idempotency-Key` header replays; → `{ run, payslips }` |
| GET  | `/payroll/runs` | run history |
| GET  | `/payroll/runs/:id` | one run |
| GET  | `/payroll/runs/:id/payslips` | payslips for a run |
| GET  | `/payslips/:id` | single payslip with full reconciled breakdown |

`payBasis.amount` is the **monthly** figure in the employer's currency.

## Quick smoke test

```bash
BASE=http://localhost:3000/api/v1
TOKEN=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"hr@acme.in","password":"password"}' \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).accessToken))')

curl -s -X POST $BASE/payroll/runs -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: demo-1' \
  -d '{"period":"2025-06"}'
```

## Tests

```bash
npm test                       # full Jest suite (server)
npx jest src/modules/tax-engine  # one module
```
