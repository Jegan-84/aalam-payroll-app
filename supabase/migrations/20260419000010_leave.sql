-- =============================================================================
-- Module 5 — Leave
-- =============================================================================
-- leave_balances   : one row per (employee, leave_type, FY). current_balance
--                    is a stored generated column so the DB is the source of
--                    truth; the app updates the deltas (used / encashed / adj).
-- leave_applications: the request + its review state. On approval, the action
--                    layer deducts from balance and writes LEAVE rows into
--                    attendance_days. On cancellation it refunds.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- leave_balances
-- -----------------------------------------------------------------------------
create table if not exists public.leave_balances (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id) on delete cascade,
  leave_type_id    int  not null references public.leave_types(id) on delete restrict,

  fy_start         date not null,
  fy_end           date not null,

  opening_balance  numeric(6,2) not null default 0,
  accrued          numeric(6,2) not null default 0,   -- for monthly accrual, future use
  carried_forward  numeric(6,2) not null default 0,
  used             numeric(6,2) not null default 0,
  encashed         numeric(6,2) not null default 0,
  adjustment       numeric(6,2) not null default 0,

  current_balance  numeric(6,2) generated always as (
                     opening_balance + accrued + carried_forward - used - encashed + adjustment
                   ) stored,

  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (employee_id, leave_type_id, fy_start)
);

create index if not exists idx_leave_balances_emp_fy
  on public.leave_balances(employee_id, fy_start);

drop trigger if exists set_updated_at on public.leave_balances;
create trigger set_updated_at before update on public.leave_balances
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- leave_applications
-- -----------------------------------------------------------------------------
create table if not exists public.leave_applications (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id) on delete cascade,
  leave_type_id    int  not null references public.leave_types(id) on delete restrict,

  from_date        date not null,
  to_date          date not null,
  days_count       numeric(6,2) not null check (days_count > 0),

  reason           text,
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','cancelled')),

  applied_at       timestamptz not null default now(),
  applied_by       uuid references public.users(id) on delete set null,

  reviewed_at      timestamptz,
  reviewed_by      uuid references public.users(id) on delete set null,
  review_notes     text,

  cancelled_at     timestamptz,
  cancelled_by     uuid references public.users(id) on delete set null,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint chk_date_range check (to_date >= from_date)
);

create index if not exists idx_la_employee   on public.leave_applications(employee_id);
create index if not exists idx_la_status     on public.leave_applications(status);
create index if not exists idx_la_date_range on public.leave_applications(from_date, to_date);

drop trigger if exists set_updated_at on public.leave_applications;
create trigger set_updated_at before update on public.leave_applications
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- View: current-FY balance snapshot per employee per leave type.
-- Assumes FY starts April 1.
-- -----------------------------------------------------------------------------
create or replace view public.v_current_leave_balances as
  select b.*
  from public.leave_balances b
  where current_date between b.fy_start and b.fy_end;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.leave_balances      enable row level security;
alter table public.leave_applications  enable row level security;

drop policy if exists "auth_read_leave_balances" on public.leave_balances;
create policy "auth_read_leave_balances" on public.leave_balances
  for select to authenticated using (true);

drop policy if exists "auth_read_leave_applications" on public.leave_applications;
create policy "auth_read_leave_applications" on public.leave_applications
  for select to authenticated using (true);
