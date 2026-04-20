# PayFlow

In-house payroll software for Aalam — single tenant, Indian statutory (Tamil Nadu), FY April–March.

Built on Next.js 16 App Router + React 19 + Supabase (Postgres + Auth + MFA) + Tailwind v4. Schema is raw SQL migrations so it can migrate off Supabase later.

## Prerequisites

- Node 20+
- A Supabase project (local CLI or hosted) with the service role key
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Apply migrations in `supabase/migrations/` in filename order, then reload PostgREST:

```sql
notify pgrst, 'reload schema';
```

First-time setup: seed statutory masters, tax slabs, PT slabs, and create an admin user via `/users/new` (or directly in Supabase Auth + `users` + `user_roles`).

## Modules

| # | Module            | Route             |
|---|-------------------|-------------------|
| 1 | Foundation        | `/dashboard`      |
| 2 | Employees         | `/employees`      |
| 3 | Salary structures | `/salary`         |
| 4 | Attendance        | `/attendance`     |
| 5 | Leave             | `/leave`          |
| 6 | Payroll runs      | `/payroll`        |
| 7 | Payslips          | `/api/payslip/*`  |
| 8 | Statutory reports | `/reports`        |
| 9 | TDS / Form 16     | `/tds`            |
|   | Settings          | `/settings`       |
|   | Users & roles     | `/users`          |

### Key features

- **Variable Pay** — toggle `include_vp` on a cycle to pay an annual VP as a taxable earning with incremental TDS in that one cycle. Per-employee linked % / amount editor on the payslip detail page.
- **Professional Tax slabs** — half-yearly periods editable from `/settings/pt`. "Start a new period" closes the current one and clones slabs for the next six months.
- **Adjustments** — per-cycle edits to earnings or deductions: `add`, `override`, `skip`. Flows into the payslip PDF and TDS after Recompute.
- **Bulk upload** — CSV templates for Employees and Leave with a preview dialog (editable rows, per-row validation).
- **Two-step verification** — Supabase MFA (TOTP) gate for login; enrolment wizard at `/mfa/setup`.
- **Global search** — ⌘K across employees, companies, cycles, leave, and page names.

## Directory overview

```
app/
  (app)/              authenticated routes (dashboard, employees, payroll, ...)
  (auth)/             login, MFA, password reset
  api/                payslip PDFs, reports, search
components/ui/        primitives (Button, Card, Pagination, Snackbar, Dialog, ...)
lib/
  auth/               session, MFA, role gates
  payroll/            monthly engine, cycle actions, VP, tax slabs
  salary/             structure queries/actions, statutory config
  attendance/, leave/ attendance engine, leave applications
  tax/                declarations, deductions (for OLD regime)
  components/         adjustments + recurring employee components
supabase/migrations/  ordered SQL migrations (timestamped filenames)
```

## Adding a migration

1. Create `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
2. Write `create table if not exists ...`, `alter table ... add column if not exists ...`, RLS policies.
3. Apply via the Supabase SQL editor (or CLI), then `notify pgrst, 'reload schema';`.

## Tax regime handling

- **NEW** regime is the default and needs no employee declaration.
- **OLD** regime uses `employee_tax_declarations` (HRA received, rent paid, 80C investments, home loan interest, etc.) to compute allowable deductions. Only approved declarations apply.

## Variable Pay — how it works

The toggle lives on the cycle header. When enabled, every active employee is seeded with an allocation: `vp_amount = annual_fixed_ctc × variable_pay_percent / 100`. HR can then click into an employee and adjust either the % or the ₹ amount — both are linked. Flip the switch off and allocations stay (they just don't apply to compute). The TDS spike happens in the VP month only — the incremental annual tax on the VP amount is collected in full that month. See `lib/payroll/monthly.ts` for the math.

## Performance notes

- Lists are paginated with URL params (`?page=N`). The `Pagination` primitive in `components/ui/` is the reusable widget.
- Indexes for hot query paths live in `supabase/migrations/20260420000003_perf_indexes.sql`.
- No Redux, no React Query — server components + server actions + `revalidatePath` cover those roles.

## Agent / Claude Code notes

This project uses Claude Code. The `AGENTS.md` at the repo root instructs the agent to read `node_modules/next/dist/docs/` before writing Next.js code — Next.js 16 has enough breaking changes from older training data that outdated patterns (sync `cookies()`/`params`, `next/router`) can compile but be wrong.
