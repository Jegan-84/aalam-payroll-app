-- =============================================================================
-- Employee Tax Declarations (for OLD regime exemptions + Chapter VI-A)
-- =============================================================================
-- One row per (employee, FY). Employees submit; HR reviews; approval flips
-- status to 'approved' and the tax engine consumes the amounts when regime
-- is OLD. NEW regime ignores everything except the standard deduction.
-- =============================================================================

create table if not exists public.employee_tax_declarations (
  id                           uuid primary key default gen_random_uuid(),
  employee_id                  uuid not null references public.employees(id) on delete cascade,

  fy_start                     date not null,
  fy_end                       date not null,
  regime                       text not null check (regime in ('NEW','OLD')),

  -- Section 80C family (capped at 150000 combined)
  sec_80c_ppf                  numeric(14,2) not null default 0,
  sec_80c_lic                  numeric(14,2) not null default 0,
  sec_80c_elss                 numeric(14,2) not null default 0,
  sec_80c_nsc                  numeric(14,2) not null default 0,
  sec_80c_tuition_fees         numeric(14,2) not null default 0,
  sec_80c_home_loan_principal  numeric(14,2) not null default 0,
  sec_80c_epf                  numeric(14,2) not null default 0,   -- auto-fill from ledger during review
  sec_80c_other                numeric(14,2) not null default 0,

  -- 80D (health insurance)
  sec_80d_self_family          numeric(14,2) not null default 0,   -- cap 25k (50k if self is senior)
  sec_80d_parents              numeric(14,2) not null default 0,   -- cap 25k (50k if parents are senior)
  sec_80d_parents_senior       boolean not null default false,
  sec_80d_self_senior          boolean not null default false,

  -- 80CCD(1B) — NPS additional (cap 50k, over and above 80C)
  sec_80ccd_1b_nps             numeric(14,2) not null default 0,

  -- 80E (education loan interest) — no cap, but payer must be individual
  sec_80e_education_loan       numeric(14,2) not null default 0,

  -- 80G (donations) — simplified; actual computation has 50%/100% qualifiers
  sec_80g_donations            numeric(14,2) not null default 0,

  -- 80TTA (savings interest) — cap 10k (non-seniors). Seniors use 80TTB (cap 50k).
  sec_80tta_savings_interest   numeric(14,2) not null default 0,

  -- Section 24(b) — home loan interest (cap 2L for self-occupied)
  home_loan_interest           numeric(14,2) not null default 0,

  -- HRA inputs (exemption is computed by the engine)
  rent_paid_annual             numeric(14,2) not null default 0,
  metro_city                   boolean not null default false,

  -- Other
  lta_claimed                  numeric(14,2) not null default 0,

  -- Workflow
  status                       text not null default 'draft'
                                 check (status in ('draft','submitted','approved','rejected')),
  submitted_at                 timestamptz,
  submitted_by                 uuid references public.users(id) on delete set null,
  reviewed_at                  timestamptz,
  reviewed_by                  uuid references public.users(id) on delete set null,
  review_notes                 text,

  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  unique (employee_id, fy_start)
);

create index if not exists idx_etd_emp_fy  on public.employee_tax_declarations(employee_id, fy_start);
create index if not exists idx_etd_status  on public.employee_tax_declarations(status);

drop trigger if exists set_updated_at on public.employee_tax_declarations;
create trigger set_updated_at before update on public.employee_tax_declarations
  for each row execute function public.tg_set_updated_at();

alter table public.employee_tax_declarations enable row level security;
drop policy if exists "auth_read_employee_tax_declarations" on public.employee_tax_declarations;
create policy "auth_read_employee_tax_declarations" on public.employee_tax_declarations
  for select to authenticated using (true);
