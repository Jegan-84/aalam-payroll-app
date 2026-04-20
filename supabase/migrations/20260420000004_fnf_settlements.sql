-- =============================================================================
-- Full & Final Settlement (F&F)
-- =============================================================================
-- One-shot settlement generated when an employee exits. It consolidates the
-- exit-month proration, leave encashment, gratuity (if eligible), notice pay
-- adjustments, any pending earnings (bonus/reimbursement) and recoveries
-- (loans, assets, shortfalls), then computes a final TDS figure based on
-- FY-to-date TDS already deducted.
--
-- Lifecycle:
--   draft  → HR entered initiation details
--   computed → engine has produced all auto lines + totals
--   approved → employee flipped to 'exited', date_of_exit set, PDF locked
--   paid   → payout confirmed; record becomes read-only
--
-- One settlement per employee (unique constraint on employee_id). Reopen
-- requires admin action.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fnf_settlements
-- -----------------------------------------------------------------------------
create table if not exists public.fnf_settlements (
  id                                uuid primary key default gen_random_uuid(),
  employee_id                       uuid not null references public.employees(id) on delete restrict,

  -- inputs captured at initiation
  last_working_day                  date not null,
  notice_period_days                int not null default 60 check (notice_period_days >= 0),
  notice_days_served                int not null default 0 check (notice_days_served >= 0),

  -- employee + company snapshots (frozen at compute — same pattern as payroll_items)
  employee_code_snapshot            text not null,
  employee_name_snapshot            text not null,
  pan_snapshot                      text,
  date_of_joining_snapshot          date not null,
  department_snapshot               text,
  designation_snapshot              text,
  location_snapshot                 text,
  bank_name_snapshot                text,
  bank_account_snapshot             text,
  bank_ifsc_snapshot                text,
  tax_regime_snapshot               text not null default 'NEW',

  -- company snapshot (mirrors payroll_items)
  company_id                        uuid references public.companies(id) on delete set null,
  company_legal_name_snapshot       text,
  company_display_name_snapshot     text,
  company_address_snapshot          text,
  company_pan_snapshot              text,
  company_tan_snapshot              text,
  company_gstin_snapshot            text,
  company_logo_snapshot             text,

  -- salary snapshot (for display + stable recompute)
  salary_structure_id               uuid references public.salary_structures(id) on delete set null,
  monthly_gross_snapshot            numeric(14,2) not null default 0,
  annual_gross_snapshot             numeric(14,2) not null default 0,
  last_basic_snapshot               numeric(14,2) not null default 0,

  -- tenure (computed at compute time)
  service_years                     numeric(5,2) not null default 0,
  service_days                      int not null default 0,
  gratuity_eligible                 boolean not null default false,

  -- rolled-up totals
  final_month_earnings              numeric(14,2) not null default 0,  -- prorated salary for exit month
  leave_encashment_days             numeric(6,2)  not null default 0,
  leave_encashment_amount           numeric(14,2) not null default 0,
  gratuity_amount                   numeric(14,2) not null default 0,
  notice_pay_payout                 numeric(14,2) not null default 0,  -- employer waived shortfall (earning)
  notice_pay_recovery               numeric(14,2) not null default 0,  -- employee did not serve notice (deduction)

  total_earnings                    numeric(14,2) not null default 0,
  total_deductions                  numeric(14,2) not null default 0,
  net_payout                        numeric(14,2) not null default 0,

  -- TDS reconciliation
  final_tds                         numeric(14,2) not null default 0,
  fy_start_snapshot                 date,
  fy_gross_before_fnf               numeric(14,2) not null default 0,
  fy_tds_before_fnf                 numeric(14,2) not null default 0,

  -- lifecycle
  status                            text not null default 'draft'
                                      check (status in ('draft','computed','approved','paid')),
  notes                             text,

  initiated_at                      timestamptz not null default now(),
  initiated_by                      uuid references public.users(id) on delete set null,
  computed_at                       timestamptz,
  approved_at                       timestamptz,
  approved_by                       uuid references public.users(id) on delete set null,
  paid_at                           timestamptz,

  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),

  unique (employee_id),
  constraint chk_notice_days check (notice_days_served <= notice_period_days)
);

create index if not exists idx_fnf_status on public.fnf_settlements(status);

drop trigger if exists set_updated_at on public.fnf_settlements;
create trigger set_updated_at before update on public.fnf_settlements
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- fnf_line_items
-- -----------------------------------------------------------------------------
-- Each line on the statement. `source`:
--   auto   — recomputed by the F&F engine (BASIC, HRA, LEAVE_ENC, GRATUITY, ...).
--            Wiped and regenerated every computeFnfAction call.
--   manual — HR-entered (bonus, loan recovery, asset adjustment, ex-gratia).
--            Persists across recomputes.
-- -----------------------------------------------------------------------------
create table if not exists public.fnf_line_items (
  id               uuid primary key default gen_random_uuid(),
  settlement_id    uuid not null references public.fnf_settlements(id) on delete cascade,

  code             text not null,
  name             text not null,
  kind             text not null check (kind in ('earning','deduction')),
  amount           numeric(14,2) not null default 0,

  source           text not null check (source in ('auto','manual')),
  display_order    int not null default 100,
  notes            text,

  created_at       timestamptz not null default now(),
  created_by       uuid references public.users(id) on delete set null
);

create index if not exists idx_fnf_line_settlement on public.fnf_line_items(settlement_id);
create index if not exists idx_fnf_line_source on public.fnf_line_items(settlement_id, source);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.fnf_settlements enable row level security;
alter table public.fnf_line_items  enable row level security;

drop policy if exists "auth_read_fnf_settlements" on public.fnf_settlements;
create policy "auth_read_fnf_settlements" on public.fnf_settlements
  for select to authenticated using (true);

drop policy if exists "auth_read_fnf_line_items" on public.fnf_line_items;
create policy "auth_read_fnf_line_items" on public.fnf_line_items
  for select to authenticated using (true);
