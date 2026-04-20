-- =============================================================================
-- Companies — legal/brand entities tagged against employees and payslips
-- =============================================================================
-- Each employee belongs to one company. The payslip PDF renders the employee's
-- company (name, address, PAN, TAN, GSTIN, logo) pulled from an immutable
-- snapshot written at payroll compute time — so editing a company later does
-- not rewrite historical payslips.
--
-- Org-wide payroll config (weekly_off, FY start, PT state, statutory rates,
-- tax slabs) stays on the existing `organizations` table. `companies` is
-- purely for display / legal fields per brand / legal entity.
-- =============================================================================

create table if not exists public.companies (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  legal_name             text not null,
  display_name           text not null,

  pan                    text,
  tan                    text,
  gstin                  text,
  cin                    text,
  epf_establishment_id   text,
  esi_establishment_id   text,
  pt_registration_no     text,

  address_line1          text,
  address_line2          text,
  city                   text,
  state                  text,
  pincode                text,
  country                text not null default 'India',

  logo_url               text,

  is_active              boolean not null default true,
  display_order          int not null default 100,

  created_at             timestamptz not null default now(),
  created_by             uuid references public.users(id) on delete set null,
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.users(id) on delete set null
);

drop trigger if exists set_updated_at on public.companies;
create trigger set_updated_at before update on public.companies
  for each row execute function public.tg_set_updated_at();

-- Seed the first company row from the existing organizations row (if any).
insert into public.companies (
  code, legal_name, display_name,
  pan, tan, gstin,
  epf_establishment_id, esi_establishment_id, pt_registration_no,
  address_line1, address_line2, city, state, pincode, country,
  logo_url
)
select
  coalesce(left(regexp_replace(upper(display_name), '[^A-Z0-9]+', '_', 'g'), 20), 'COMPANY_1'),
  legal_name,
  display_name,
  pan, tan, gstin,
  epf_establishment_id, esi_establishment_id, pt_registration_no,
  address_line1, address_line2, city, state, pincode, country,
  logo_url
from public.organizations
order by created_at
limit 1
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Tag employees with a company
-- -----------------------------------------------------------------------------
alter table public.employees
  add column if not exists company_id uuid references public.companies(id) on delete restrict;

-- Backfill: anyone without a company gets the first seeded company.
update public.employees
set company_id = (select id from public.companies order by created_at limit 1)
where company_id is null;

create index if not exists idx_employees_company on public.employees(company_id);

-- -----------------------------------------------------------------------------
-- Snapshot company on payroll_items (immutable)
-- -----------------------------------------------------------------------------
alter table public.payroll_items
  add column if not exists company_id                    uuid references public.companies(id) on delete set null,
  add column if not exists company_legal_name_snapshot   text,
  add column if not exists company_display_name_snapshot text,
  add column if not exists company_address_snapshot      text,
  add column if not exists company_pan_snapshot          text,
  add column if not exists company_tan_snapshot          text,
  add column if not exists company_gstin_snapshot        text,
  add column if not exists company_logo_snapshot         text;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.companies enable row level security;
drop policy if exists "auth_read_companies" on public.companies;
create policy "auth_read_companies" on public.companies
  for select to authenticated using (true);
