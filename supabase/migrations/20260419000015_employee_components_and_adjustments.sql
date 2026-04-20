-- =============================================================================
-- Per-employee recurring pay components + per-cycle adjustments
-- =============================================================================
--   employee_pay_components
--     Standing lines attached to an employee. e.g. SHIFT allowance (earning),
--     LUNCH deduction (deduction), TRANSPORT (either). Auto-applied to every
--     payroll cycle between effective_from and effective_to.
--
--   payroll_item_adjustments
--     One-off changes for a specific (cycle, employee). Three actions:
--       add      — extra line (e.g. diwali bonus)
--       override — replace the amount for a matching recurring code
--       skip     — exclude a recurring component for this one cycle
--     (For lunch: employee didn't take lunch this month → action='skip',
--      code='LUNCH', no amount needed.)
-- =============================================================================

create table if not exists public.employee_pay_components (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id) on delete cascade,

  code             text not null,                 -- e.g. 'SHIFT','LUNCH','TRANSPORT_DED'
  name             text not null,                 -- display label
  kind             text not null check (kind in ('earning','deduction')),

  monthly_amount   numeric(14,2) not null check (monthly_amount >= 0),
  prorate          boolean not null default false,    -- prorate by paid_days/days_in_month (e.g. shift allowance)
  include_in_gross boolean not null default false,    -- include in ESI / TDS base? (conservative default off)

  effective_from   date not null,
  effective_to     date,                              -- null = current
  is_active        boolean not null default true,

  notes            text,
  created_at       timestamptz not null default now(),
  created_by       uuid references public.users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.users(id) on delete set null,

  constraint chk_eff_range check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_epc_employee on public.employee_pay_components(employee_id);
create index if not exists idx_epc_active   on public.employee_pay_components(employee_id, effective_from, effective_to) where is_active;

drop trigger if exists set_updated_at on public.employee_pay_components;
create trigger set_updated_at before update on public.employee_pay_components
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Per-cycle adjustments
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_item_adjustments (
  id             uuid primary key default gen_random_uuid(),
  cycle_id       uuid not null references public.payroll_cycles(id) on delete cascade,
  employee_id    uuid not null references public.employees(id) on delete cascade,

  code           text not null,
  name           text not null,
  kind           text not null check (kind in ('earning','deduction')),
  amount         numeric(14,2) not null default 0,

  -- 'add':      new one-off line for this cycle (kind + amount used)
  -- 'override': replace amount for a matching recurring code in this cycle
  -- 'skip':     exclude a matching recurring code for this cycle (amount ignored)
  action         text not null default 'add' check (action in ('add','override','skip')),

  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.users(id) on delete set null,

  unique (cycle_id, employee_id, code, action)
);

create index if not exists idx_pia_cycle_emp on public.payroll_item_adjustments(cycle_id, employee_id);

-- RLS
alter table public.employee_pay_components    enable row level security;
alter table public.payroll_item_adjustments   enable row level security;

drop policy if exists "auth_read_employee_pay_components" on public.employee_pay_components;
create policy "auth_read_employee_pay_components" on public.employee_pay_components
  for select to authenticated using (true);

drop policy if exists "auth_read_payroll_item_adjustments" on public.payroll_item_adjustments;
create policy "auth_read_payroll_item_adjustments" on public.payroll_item_adjustments
  for select to authenticated using (true);
