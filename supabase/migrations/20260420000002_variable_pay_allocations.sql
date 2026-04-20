-- =============================================================================
-- Variable Pay — cycle-level toggle + per-employee allocations
-- =============================================================================
-- VP is a once-a-year (or once-in-a-cycle) payout. When the cycle-level
-- switch `include_vp` is ON, each employee's allocation is added as a taxable
-- earning line for that month. Allocations are seeded from the employee's
-- salary structure (`variable_pay_percent` × `annual_fixed_ctc`) but HR can
-- override either the percentage or the amount per-employee.
--
-- Design notes
--   - `payroll_cycles.include_vp` is the master switch (off by default).
--     Toggling off does NOT delete allocations — they persist so HR can flip
--     the switch back without re-entering amounts.
--   - `payroll_cycle_vp_allocations` stores both pct and amount so the UI can
--     render either without recomputing. Editing one updates the other.
--   - Amount is the authoritative field at compute time; pct is stored for
--     display / audit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cycle-level toggle
-- -----------------------------------------------------------------------------
alter table public.payroll_cycles
  add column if not exists include_vp boolean not null default false;

-- -----------------------------------------------------------------------------
-- Per-(cycle × employee) VP allocation
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_cycle_vp_allocations (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references public.payroll_cycles(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,

  vp_pct          numeric(7,3)  not null default 0 check (vp_pct >= 0),
  vp_amount       numeric(14,2) not null default 0 check (vp_amount >= 0),

  -- Snapshot of the CTC used to derive the seed (for audit / avoid re-fetch).
  annual_fixed_ctc_snapshot numeric(14,2) not null default 0,

  created_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.users(id) on delete set null,

  unique (cycle_id, employee_id)
);

create index if not exists idx_vp_alloc_cycle on public.payroll_cycle_vp_allocations(cycle_id);

drop trigger if exists set_updated_at on public.payroll_cycle_vp_allocations;
create trigger set_updated_at before update on public.payroll_cycle_vp_allocations
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.payroll_cycle_vp_allocations enable row level security;

drop policy if exists "auth_read_payroll_cycle_vp_allocations" on public.payroll_cycle_vp_allocations;
create policy "auth_read_payroll_cycle_vp_allocations" on public.payroll_cycle_vp_allocations
  for select to authenticated using (true);
