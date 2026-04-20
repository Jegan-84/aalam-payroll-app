-- =============================================================================
-- Module 1 Foundation — Leave types and Holidays
-- =============================================================================
-- Applications/balances land in Module 5 migrations. Here we set up just the
-- types and the holiday calendar since they're pure masters.
-- =============================================================================

create table if not exists public.leave_types (
  id                      serial primary key,
  code                    text not null unique,
  name                    text not null,
  is_paid                 boolean not null default true,
  annual_quota_days       numeric(6,2) not null default 0,   -- 0 for LOP
  accrual_type            text not null default 'annual'
    check (accrual_type in ('annual','monthly','none')),
  carry_forward_max_days  numeric(6,2) not null default 0,
  encashable_on_exit      boolean not null default false,
  includes_weekends       boolean not null default false,    -- for day-count calc
  is_active               boolean not null default true,
  display_order           int not null default 100,
  created_at              timestamptz not null default now()
);

create table if not exists public.holidays (
  id             serial primary key,
  financial_year text not null,            -- '2026-27'
  holiday_date   date not null,
  name           text not null,
  type           text not null default 'public' check (type in ('public','restricted','optional')),
  location_id    int references public.locations(id) on delete set null,  -- null = all locations
  created_at     timestamptz not null default now(),
  unique (holiday_date, location_id)
);

create index if not exists idx_holidays_fy on public.holidays(financial_year);
