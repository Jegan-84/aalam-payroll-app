-- =============================================================================
-- Phase 4 — Compensatory Off grants with 30-day expiry
-- =============================================================================
-- Each comp off is a discrete grant: "employee worked on Sun 5-May, HR grants
-- 1 day comp off, expires 30 days later on 4-Jun". The employee can apply it
-- via a normal COMP_OFF leave application before that date; otherwise a sweep
-- expires it.
--
-- We keep `leave_balances.current_balance` as the source of truth for quick
-- balance checks, but recompute it each time the comp_off_grants table
-- changes. Think of comp_off_grants as the ledger and leave_balances.accrued
-- as a cached total of NON-EXPIRED grants.
-- =============================================================================

create table if not exists public.comp_off_grants (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete cascade,

  work_date       date not null,           -- the day worked (Sunday / holiday)
  granted_days    numeric(4,2) not null default 1 check (granted_days > 0),
  reason          text,

  granted_at      timestamptz not null default now(),
  granted_by      uuid references public.users(id) on delete set null,

  expires_on      date not null,            -- work_date + 30 days by default
  status          text not null default 'active'
                    check (status in ('active', 'used', 'expired', 'revoked')),

  -- When used: which leave application consumed it (lets HR trace)
  used_in_leave_id uuid references public.leave_applications(id) on delete set null,
  used_at          timestamptz,

  -- When expired / revoked: ledger stamp
  closed_at        timestamptz,
  closed_reason    text,

  created_at       timestamptz not null default now()
);

create index if not exists idx_compoff_emp_active
  on public.comp_off_grants(employee_id, expires_on)
  where status = 'active';

create index if not exists idx_compoff_expiry
  on public.comp_off_grants(expires_on)
  where status = 'active';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.comp_off_grants enable row level security;

drop policy if exists "auth_read_comp_off_grants" on public.comp_off_grants;
create policy "auth_read_comp_off_grants" on public.comp_off_grants
  for select to authenticated using (true);

comment on table public.comp_off_grants is
  'Per-grant ledger for compensatory off. Each row has a 30-day expiry from work_date. Sum of active grants per employee = usable COMP_OFF balance.';
