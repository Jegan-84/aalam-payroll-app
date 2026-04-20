-- =============================================================================
-- Module 6 — Payroll Runs
-- =============================================================================
-- payroll_cycles    : one row per (year, month). Lifecycle:
--                       draft → computed → approved → locked → (paid)
-- payroll_items     : one row per (cycle × employee). Snapshots everything
--                     needed to regenerate the payslip.
-- payroll_item_components : line-level breakdown for each item.
--
-- Attendance lock: when a cycle is approved, all attendance_days rows for
-- that month+employees are set to locked=true (done by server action).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- payroll_cycles
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_cycles (
  id                   uuid primary key default gen_random_uuid(),
  year                 int not null check (year between 2000 and 2100),
  month                int not null check (month between 1 and 12),
  cycle_start          date not null,
  cycle_end            date not null,

  status               text not null default 'draft'
                        check (status in ('draft','computed','approved','locked','paid')),

  -- running counts / totals (updated by actions; not generated so we can read them fast)
  employee_count       int  not null default 0,
  total_gross          numeric(16,2) not null default 0,
  total_deductions     numeric(16,2) not null default 0,
  total_net_pay        numeric(16,2) not null default 0,
  total_employer_cost  numeric(16,2) not null default 0,

  notes                text,

  opened_at            timestamptz not null default now(),
  opened_by            uuid references public.users(id) on delete set null,
  computed_at          timestamptz,
  approved_at          timestamptz,
  approved_by          uuid references public.users(id) on delete set null,
  locked_at            timestamptz,
  locked_by            uuid references public.users(id) on delete set null,
  paid_at              timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (year, month)
);

drop trigger if exists set_updated_at on public.payroll_cycles;
create trigger set_updated_at before update on public.payroll_cycles
  for each row execute function public.tg_set_updated_at();

create index if not exists idx_payroll_cycles_year on public.payroll_cycles(year, month);
create index if not exists idx_payroll_cycles_status on public.payroll_cycles(status);

-- -----------------------------------------------------------------------------
-- payroll_items — one per employee per cycle
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_items (
  id                       uuid primary key default gen_random_uuid(),
  cycle_id                 uuid not null references public.payroll_cycles(id) on delete cascade,
  employee_id              uuid not null references public.employees(id) on delete restrict,
  salary_structure_id      uuid references public.salary_structures(id) on delete set null,

  -- snapshots (written once; never recomputed after approve)
  employee_code_snapshot   text not null,
  employee_name_snapshot   text not null,
  pan_snapshot             text,
  department_snapshot      text,
  designation_snapshot     text,
  location_snapshot        text,
  bank_name_snapshot       text,
  bank_account_snapshot    text,
  bank_ifsc_snapshot       text,
  tax_regime_snapshot      text,

  -- attendance signals
  days_in_month            int  not null,
  paid_days                numeric(6,2) not null,
  lop_days                 numeric(6,2) not null,
  leave_days               numeric(6,2) not null,
  proration_factor         numeric(7,6) not null,    -- paid_days / days_in_month

  -- rolled-up totals
  monthly_gross            numeric(14,2) not null,
  total_earnings           numeric(14,2) not null,
  total_deductions         numeric(14,2) not null,
  net_pay                  numeric(14,2) not null,
  employer_retirals        numeric(14,2) not null,
  monthly_tds              numeric(14,2) not null default 0,
  annual_tax_estimate      numeric(14,2) not null default 0,

  status                   text not null default 'draft'
                            check (status in ('draft','approved','locked')),

  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (cycle_id, employee_id)
);

create index if not exists idx_payroll_items_cycle    on public.payroll_items(cycle_id);
create index if not exists idx_payroll_items_employee on public.payroll_items(employee_id);

drop trigger if exists set_updated_at on public.payroll_items;
create trigger set_updated_at before update on public.payroll_items
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- payroll_item_components
-- -----------------------------------------------------------------------------
create table if not exists public.payroll_item_components (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references public.payroll_items(id) on delete cascade,
  pay_component_id  int  references public.pay_components(id) on delete set null,
  code              text not null,
  name              text not null,
  kind              text not null,   -- earning / deduction / employer_retiral / reimbursement / variable
  amount            numeric(14,2) not null default 0,   -- MONTHLY amount for this cycle
  display_order     int not null default 100
);

create index if not exists idx_pic_item on public.payroll_item_components(item_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.payroll_cycles           enable row level security;
alter table public.payroll_items            enable row level security;
alter table public.payroll_item_components  enable row level security;

drop policy if exists "auth_read_payroll_cycles" on public.payroll_cycles;
create policy "auth_read_payroll_cycles" on public.payroll_cycles
  for select to authenticated using (true);

drop policy if exists "auth_read_payroll_items" on public.payroll_items;
create policy "auth_read_payroll_items" on public.payroll_items
  for select to authenticated using (true);

drop policy if exists "auth_read_payroll_item_components" on public.payroll_item_components;
create policy "auth_read_payroll_item_components" on public.payroll_item_components
  for select to authenticated using (true);
