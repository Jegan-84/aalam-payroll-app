-- =============================================================================
-- TDS challans + Form 24Q support
-- =============================================================================
-- Indian employers deposit TDS (section 192) to the government monthly and
-- report it quarterly via Form 24Q. Each deposit produces a "challan" with a
-- BSR code (7-digit bank branch code) and a challan serial number that must
-- appear on Form 24Q and on every employee's Form 16 Part A.
--
-- This table records each deposit so reports can reconcile:
--   (sum of monthly_tds across all payslips) == (sum of challan amounts)
-- =============================================================================

create table if not exists public.tds_challans (
  id                uuid primary key default gen_random_uuid(),

  -- Period covered by this deposit (almost always one calendar month).
  year              int not null check (year between 2000 and 2100),
  month             int not null check (month between 1 and 12),
  fy_start          date not null,
  quarter           int not null check (quarter between 1 and 4),

  -- Challan identity — required on Form 24Q + Form 16 Part A.
  bsr_code          text not null,                           -- 7 digits (bank branch)
  challan_serial_no text not null,                           -- 5 digits
  deposit_date      date not null,

  -- Amounts (all in ₹)
  tds_amount        numeric(14,2) not null default 0 check (tds_amount >= 0),
  surcharge         numeric(14,2) not null default 0 check (surcharge >= 0),
  cess              numeric(14,2) not null default 0 check (cess >= 0),
  interest          numeric(14,2) not null default 0 check (interest >= 0),
  penalty           numeric(14,2) not null default 0 check (penalty >= 0),
  total_amount      numeric(14,2) generated always as
                      (tds_amount + surcharge + cess + interest + penalty) stored,

  section           text not null default '192',             -- always 192 for salary
  notes             text,

  created_at        timestamptz not null default now(),
  created_by        uuid references public.users(id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.users(id) on delete set null,

  unique (year, month, bsr_code, challan_serial_no)
);

create index if not exists idx_tds_challans_fy_quarter on public.tds_challans(fy_start, quarter);
create index if not exists idx_tds_challans_year_month on public.tds_challans(year, month);

drop trigger if exists set_updated_at on public.tds_challans;
create trigger set_updated_at before update on public.tds_challans
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.tds_challans enable row level security;

drop policy if exists "auth_read_tds_challans" on public.tds_challans;
create policy "auth_read_tds_challans" on public.tds_challans
  for select to authenticated using (true);
