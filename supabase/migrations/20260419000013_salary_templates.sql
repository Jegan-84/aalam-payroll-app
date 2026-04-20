-- =============================================================================
-- Salary Templates — named presets used to pre-fill per-employee structures.
-- =============================================================================
-- A template is a reusable bundle of CTC amount + fixed benefits + EPF mode.
-- Applying a template writes a normal salary_structures row for the employee,
-- carrying `template_id` for lineage. Editing a template does NOT retro-change
-- structures already created (snapshot semantics preserved).
-- =============================================================================

create table if not exists public.salary_templates (
  id                         uuid primary key default gen_random_uuid(),
  code                       text not null unique,
  name                       text not null,
  description                text,

  -- optional associations (for filtering in the UI)
  employment_type            text check (employment_type in ('full_time','contract','intern','consultant')),
  designation_id             int references public.designations(id) on delete set null,

  -- preset values (mirror salary_structures inputs)
  annual_fixed_ctc           numeric(14,2) not null check (annual_fixed_ctc > 0),
  variable_pay_percent       numeric(6,3)  not null default 10 check (variable_pay_percent >= 0),
  medical_insurance_monthly  numeric(14,2) not null default 500,
  internet_annual            numeric(14,2) not null default 12000,
  training_annual            numeric(14,2) not null default 12000,
  epf_mode                   text not null default 'ceiling'
                              check (epf_mode in ('ceiling','fixed_max','actual')),

  notes                      text,
  is_active                  boolean not null default true,
  display_order              int not null default 100,

  created_at                 timestamptz not null default now(),
  created_by                 uuid references public.users(id) on delete set null,
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid references public.users(id) on delete set null
);

drop trigger if exists set_updated_at on public.salary_templates;
create trigger set_updated_at before update on public.salary_templates
  for each row execute function public.tg_set_updated_at();

create index if not exists idx_salary_templates_active on public.salary_templates(is_active, display_order) where is_active;
create index if not exists idx_salary_templates_type   on public.salary_templates(employment_type);

-- Tie a salary_structure back to the template it was started from (optional lineage).
alter table public.salary_structures
  add column if not exists template_id uuid references public.salary_templates(id) on delete set null;

create index if not exists idx_salary_structures_template on public.salary_structures(template_id);

-- RLS
alter table public.salary_templates enable row level security;
drop policy if exists "auth_read_salary_templates" on public.salary_templates;
create policy "auth_read_salary_templates" on public.salary_templates
  for select to authenticated using (true);
