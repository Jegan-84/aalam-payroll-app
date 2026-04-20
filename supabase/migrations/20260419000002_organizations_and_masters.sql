-- =============================================================================
-- Module 1 Foundation — Organization config, departments, designations, locations
-- =============================================================================
-- Single-tenant: `organizations` holds exactly one row (Aalam).
-- Kept as a table (not hardcoded) so org-wide settings are editable via UI.
-- =============================================================================

create table if not exists public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  legal_name            text not null,
  display_name          text not null,
  pan                   text,
  tan                   text,
  gstin                 text,
  cin                   text,
  epf_establishment_id  text,          -- PF code
  esi_establishment_id  text,
  pt_registration_no    text,
  pt_state_code         text not null default 'TN',
  address_line1         text,
  address_line2         text,
  city                  text,
  state                 text,
  pincode               text,
  country               text not null default 'India',
  logo_url              text,
  financial_year_start_month smallint not null default 4   -- April
    check (financial_year_start_month between 1 and 12),
  payroll_cycle         text not null default 'monthly'
    check (payroll_cycle in ('monthly')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.organizations;
create trigger set_updated_at before update on public.organizations
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Masters: departments, designations, locations
-- -----------------------------------------------------------------------------
create table if not exists public.departments (
  id          serial primary key,
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.designations (
  id          serial primary key,
  code        text not null unique,
  name        text not null,
  grade       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.locations (
  id              serial primary key,
  code            text not null unique,
  name            text not null,
  address_line1   text,
  address_line2   text,
  city            text,
  state           text not null,      -- drives PT state
  pincode         text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Pay components (earnings, deductions, employer retirals)
-- -----------------------------------------------------------------------------
create table if not exists public.pay_components (
  id                serial primary key,
  code              text not null unique,     -- BASIC, HRA, CONV, OTHERALLOW, PF_EE, PF_ER, ESI_EE, ESI_ER, PT, GRATUITY, MEDINS, INTERNET, TDS, etc.
  name              text not null,
  kind              text not null check (kind in ('earning','deduction','employer_retiral','reimbursement','variable')),
  taxable           boolean not null default true,
  include_in_gross  boolean not null default true,   -- whether it rolls up to the printed "Gross"
  calculation_type  text not null check (calculation_type in ('fixed','percent_of_basic','percent_of_gross','formula','balancing')),
  percent_value     numeric(7,4),                    -- when calculation_type in percent_* types
  cap_amount        numeric(14,2),                   -- absolute monthly cap if any
  formula           text,                            -- free text, parsed by calc engine when kind='formula'
  display_order     int not null default 100,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_pay_components_kind on public.pay_components(kind) where is_active;
