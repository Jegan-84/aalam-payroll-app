-- =============================================================================
-- Module 9 — TDS ledger (for Form 16 Part B and Form 24Q)
-- =============================================================================
-- One row per (employee × FY × month) snapshotting salary & TDS as paid. Rows
-- are written when a payroll cycle is APPROVED and deleted when the cycle is
-- reopened. Form 16 aggregates across 12 months; Form 24Q across a quarter.
-- =============================================================================

create table if not exists public.tds_ledger (
  id                          uuid primary key default gen_random_uuid(),
  employee_id                 uuid not null references public.employees(id) on delete cascade,
  cycle_id                    uuid not null references public.payroll_cycles(id) on delete cascade,
  payroll_item_id             uuid references public.payroll_items(id) on delete set null,

  fy_start                    date not null,
  fy_end                      date not null,
  year                        int  not null,
  month                       int  not null check (month between 1 and 12),

  -- identity snapshots (so Form 16 is stable even if employee master edits later)
  employee_code_snapshot      text not null,
  employee_name_snapshot      text not null,
  pan_snapshot                text,
  tax_regime_snapshot         text not null,

  -- monthly amounts
  gross_earnings              numeric(14,2) not null default 0,
  basic_month                 numeric(14,2) not null default 0,
  hra_month                   numeric(14,2) not null default 0,
  conveyance_month            numeric(14,2) not null default 0,
  other_allowance_month       numeric(14,2) not null default 0,
  professional_tax_month      numeric(14,2) not null default 0,
  pf_employee_month           numeric(14,2) not null default 0,
  tds_deducted                numeric(14,2) not null default 0,

  -- annualized estimates at time of this cycle (for audit; Form 16 recomputes from sums)
  annual_gross_estimate       numeric(14,2) not null default 0,
  annual_tax_estimate         numeric(14,2) not null default 0,

  created_at                  timestamptz not null default now(),

  unique (employee_id, year, month)
);

create index if not exists idx_tds_ledger_emp_fy on public.tds_ledger(employee_id, fy_start);
create index if not exists idx_tds_ledger_cycle  on public.tds_ledger(cycle_id);

-- RLS
alter table public.tds_ledger enable row level security;
drop policy if exists "auth_read_tds_ledger" on public.tds_ledger;
create policy "auth_read_tds_ledger" on public.tds_ledger
  for select to authenticated using (true);
