-- =============================================================================
-- Module 3 — Salary Structures
-- =============================================================================
-- A structure is a versioned, effective-dated CTC template for an employee.
-- Creating a new structure supersedes the prior one (effective_to closed).
-- Component lines store the ENGINE'S OUTPUT at the time of creation so the
-- structure remains stable even if master rates change later.
--
-- Recomputing is explicit: create a new structure. Old structures are kept
-- verbatim for audit / historical payslip generation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- salary_structures
-- -----------------------------------------------------------------------------
create table if not exists public.salary_structures (
  id                       uuid primary key default gen_random_uuid(),
  employee_id              uuid not null references public.employees(id) on delete cascade,

  effective_from           date not null,
  effective_to             date,              -- null = current row
  status                   text not null default 'active'
                           check (status in ('active','superseded','draft')),

  -- inputs
  annual_fixed_ctc         numeric(14,2) not null check (annual_fixed_ctc > 0),
  variable_pay_percent     numeric(6,3)  not null default 10 check (variable_pay_percent >= 0),

  -- per-structure fixed overrides for components flagged as 'fixed' in masters
  medical_insurance_monthly numeric(14,2) not null default 500,
  internet_annual          numeric(14,2) not null default 12000,
  training_annual          numeric(14,2) not null default 12000,

  -- PF computation mode
  --   'ceiling' : PF = 12% × min(Basic, wage_ceiling)   (statutory minimum)
  --   'fixed_max': PF = epf_max_monthly_contribution always (company-paid-max convention)
  --   'actual'   : PF = 12% × Basic (no cap, voluntary top-up)
  epf_mode                 text not null default 'ceiling'
                           check (epf_mode in ('ceiling','fixed_max','actual')),

  -- computed outputs (captured at creation)
  annual_gross             numeric(14,2) not null,
  annual_variable_pay      numeric(14,2) not null,
  annual_total_ctc         numeric(14,2) not null,
  monthly_gross            numeric(14,2) not null,
  monthly_take_home        numeric(14,2) not null,

  notes                    text,
  created_at               timestamptz not null default now(),
  created_by               uuid references public.users(id) on delete set null,

  constraint chk_effective_range
    check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_sal_emp        on public.salary_structures(employee_id);
create index if not exists idx_sal_emp_active on public.salary_structures(employee_id, effective_from desc);

-- At most one currently-active structure per employee (effective_to is null).
create unique index if not exists ux_sal_current_per_emp
  on public.salary_structures(employee_id)
  where effective_to is null and status = 'active';

-- -----------------------------------------------------------------------------
-- salary_structure_components
-- -----------------------------------------------------------------------------
-- One row per pay component snapshotted for this structure. Kind mirrors
-- pay_components.kind so reports can roll up without a join.
-- -----------------------------------------------------------------------------
create table if not exists public.salary_structure_components (
  id                    uuid primary key default gen_random_uuid(),
  structure_id          uuid not null references public.salary_structures(id) on delete cascade,
  pay_component_id      int  not null references public.pay_components(id) on delete restrict,
  component_code        text not null,      -- denormalized for audit
  component_name        text not null,
  kind                  text not null,
  monthly_amount        numeric(14,2) not null default 0,
  annual_amount         numeric(14,2) not null default 0,
  display_order         int not null default 100,
  unique (structure_id, pay_component_id)
);

create index if not exists idx_ssc_structure on public.salary_structure_components(structure_id);

-- -----------------------------------------------------------------------------
-- View: current salary structure per employee
-- -----------------------------------------------------------------------------
create or replace view public.v_employee_current_salary as
  select s.*
  from public.salary_structures s
  where s.effective_to is null and s.status = 'active';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.salary_structures            enable row level security;
alter table public.salary_structure_components  enable row level security;

drop policy if exists "auth_read_salary_structures" on public.salary_structures;
create policy "auth_read_salary_structures" on public.salary_structures
  for select to authenticated using (true);

drop policy if exists "auth_read_salary_structure_components" on public.salary_structure_components;
create policy "auth_read_salary_structure_components" on public.salary_structure_components
  for select to authenticated using (true);
