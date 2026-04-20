-- =============================================================================
-- Module 1 Foundation — Statutory masters (PT, Income Tax slabs)
-- =============================================================================
-- Slab tables are effective-dated so rate changes are a new row, never an edit.
-- Payroll engine joins on (state_code, period_start <= cycle <= period_end).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Professional Tax (state-specific, slab-based)
-- TN PT is half-yearly: Apr–Sep and Oct–Mar. We store per-half-year slabs and
-- the engine divides by 6 for monthly deduction.
-- -----------------------------------------------------------------------------
create table if not exists public.pt_slabs (
  id                serial primary key,
  state_code        text not null,               -- 'TN', 'KA', etc.
  effective_from    date not null,
  effective_to      date,                        -- null => current
  half_year_gross_min numeric(14,2) not null,    -- slab lower bound (inclusive)
  half_year_gross_max numeric(14,2),             -- slab upper bound (inclusive). null => open-ended
  half_year_pt_amount numeric(14,2) not null,    -- amount to deduct for the half year
  created_at        timestamptz not null default now()
);

create index if not exists idx_pt_slabs_lookup
  on public.pt_slabs(state_code, effective_from);

-- -----------------------------------------------------------------------------
-- Income Tax slabs (TDS on salary)
-- -----------------------------------------------------------------------------
create table if not exists public.tax_regimes (
  id          serial primary key,
  code        text not null unique,    -- 'NEW', 'OLD'
  name        text not null,
  description text
);

create table if not exists public.tax_slabs (
  id                serial primary key,
  regime_id         int not null references public.tax_regimes(id) on delete restrict,
  fy_start          date not null,     -- e.g. 2026-04-01
  fy_end            date not null,     -- e.g. 2027-03-31
  taxable_income_min numeric(14,2) not null,
  taxable_income_max numeric(14,2),    -- null => open-ended
  rate_percent      numeric(6,3) not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_tax_slabs_lookup
  on public.tax_slabs(regime_id, fy_start);

-- -----------------------------------------------------------------------------
-- Tax configuration (rebates, surcharge, cess, std deduction) per FY+regime
-- Engine reads from here instead of hardcoding.
-- -----------------------------------------------------------------------------
create table if not exists public.tax_config (
  id                        serial primary key,
  regime_id                 int not null references public.tax_regimes(id) on delete restrict,
  fy_start                  date not null,
  fy_end                    date not null,
  standard_deduction        numeric(14,2) not null default 0,
  rebate_87a_income_limit   numeric(14,2) not null default 0,     -- taxable income under which rebate applies
  rebate_87a_max_amount     numeric(14,2) not null default 0,
  cess_percent              numeric(6,3) not null default 4,      -- Health & Education cess
  surcharge_enabled         boolean not null default true,
  created_at                timestamptz not null default now(),
  unique (regime_id, fy_start)
);

-- Surcharge slabs (applies to tax amount for high incomes)
create table if not exists public.tax_surcharge_slabs (
  id                serial primary key,
  regime_id         int not null references public.tax_regimes(id) on delete restrict,
  fy_start          date not null,
  fy_end            date not null,
  taxable_income_min numeric(14,2) not null,
  taxable_income_max numeric(14,2),
  surcharge_percent  numeric(6,3) not null
);

create index if not exists idx_tax_surcharge_lookup
  on public.tax_surcharge_slabs(regime_id, fy_start);

-- -----------------------------------------------------------------------------
-- Statutory caps (EPF, ESI) — also effective-dated
-- -----------------------------------------------------------------------------
create table if not exists public.statutory_config (
  id                            serial primary key,
  effective_from                date not null,
  effective_to                  date,
  epf_employee_percent          numeric(6,3) not null default 12,
  epf_employer_percent          numeric(6,3) not null default 12,
  epf_wage_ceiling              numeric(14,2) not null default 15000,  -- basic cap for PF
  epf_max_monthly_contribution  numeric(14,2) not null default 1800,   -- 12% of 15000
  esi_employee_percent          numeric(6,3) not null default 0.75,
  esi_employer_percent          numeric(6,3) not null default 3.25,
  esi_wage_ceiling              numeric(14,2) not null default 21000,  -- applicable only if gross <= this
  gratuity_percent              numeric(6,3) not null default 4.81,
  created_at                    timestamptz not null default now()
);
