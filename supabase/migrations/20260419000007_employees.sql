-- =============================================================================
-- Module 2 — Employees
-- =============================================================================
-- One row per person. employment_history preserves point-in-time snapshots of
-- department/designation/location/manager so historical payslips render with
-- the correct titles. documents stores metadata; actual files live in
-- Supabase Storage (bucket 'employee-docs').
-- =============================================================================

-- -----------------------------------------------------------------------------
-- employees
-- -----------------------------------------------------------------------------
create table if not exists public.employees (
  id                        uuid primary key default gen_random_uuid(),

  -- system identity
  employee_code             text not null unique,              -- e.g. AAL001
  user_id                   uuid references public.users(id) on delete set null,  -- null until self-service invited
  work_email                citext not null unique,

  -- personal
  first_name                text not null,
  middle_name               text,
  last_name                 text not null,
  full_name_snapshot        text generated always as (
                              trim(both ' ' from
                                coalesce(first_name,'') ||
                                case when middle_name is not null and length(middle_name) > 0 then ' ' || middle_name else '' end ||
                                case when last_name   is not null and length(last_name)   > 0 then ' ' || last_name   else '' end
                              )
                            ) stored,
  date_of_birth             date,
  gender                    text check (gender in ('M','F','O')),
  marital_status            text check (marital_status in ('single','married','divorced','widowed')),
  blood_group               text,
  personal_email            citext,
  personal_phone            text,
  emergency_contact_name    text,
  emergency_contact_relation text,
  emergency_contact_phone   text,

  -- addresses
  current_address_line1     text,
  current_address_line2     text,
  current_address_city      text,
  current_address_state     text,
  current_address_pincode   text,
  current_address_country   text default 'India',
  permanent_same_as_current boolean not null default true,
  permanent_address_line1   text,
  permanent_address_line2   text,
  permanent_address_city    text,
  permanent_address_state   text,
  permanent_address_pincode text,
  permanent_address_country text default 'India',

  -- statutory ids
  pan_number                text,
  aadhaar_number            text,
  uan_number                text,
  esi_number                text,
  passport_number           text,

  -- employment
  department_id             int references public.departments(id) on delete restrict,
  designation_id            int references public.designations(id) on delete restrict,
  location_id               int references public.locations(id)    on delete restrict,
  reports_to                uuid references public.employees(id)   on delete set null,
  employment_type           text not null default 'full_time'
                              check (employment_type in ('full_time','contract','intern','consultant')),
  date_of_joining           date not null,
  date_of_confirmation      date,
  probation_end_date        date,
  employment_status         text not null default 'active'
                              check (employment_status in ('active','on_notice','resigned','terminated','exited','on_hold')),
  date_of_exit              date,
  exit_reason               text,

  -- bank
  bank_name                 text,
  bank_account_number       text,
  bank_ifsc                 text,
  bank_account_type         text check (bank_account_type in ('savings','current')),
  bank_account_holder_name  text,

  -- tax
  tax_regime_code           text default 'NEW' check (tax_regime_code in ('NEW','OLD')),

  -- housekeeping
  created_at                timestamptz not null default now(),
  created_by                uuid references public.users(id) on delete set null,
  updated_at                timestamptz not null default now(),
  updated_by                uuid references public.users(id) on delete set null,

  -- constraints
  constraint chk_pan_format     check (pan_number is null or pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  constraint chk_aadhaar_format check (aadhaar_number is null or aadhaar_number ~ '^[0-9]{12}$'),
  constraint chk_ifsc_format    check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  constraint chk_exit_date      check (date_of_exit is null or date_of_exit >= date_of_joining)
);

-- unique where present (allows blanks for early-stage records)
create unique index if not exists ux_employees_pan     on public.employees(pan_number)     where pan_number     is not null;
create unique index if not exists ux_employees_aadhaar on public.employees(aadhaar_number) where aadhaar_number is not null;
create unique index if not exists ux_employees_uan     on public.employees(uan_number)     where uan_number     is not null;

create index if not exists idx_employees_department  on public.employees(department_id);
create index if not exists idx_employees_designation on public.employees(designation_id);
create index if not exists idx_employees_location    on public.employees(location_id);
create index if not exists idx_employees_manager     on public.employees(reports_to);
create index if not exists idx_employees_status      on public.employees(employment_status);
create index if not exists idx_employees_doj         on public.employees(date_of_joining);
create index if not exists idx_employees_name_search on public.employees using gin (to_tsvector('simple',
  coalesce(first_name,'') || ' ' || coalesce(middle_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(employee_code,'') || ' ' || coalesce(work_email::text,'')
));

drop trigger if exists set_updated_at on public.employees;
create trigger set_updated_at before update on public.employees
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- employee_employment_history
-- -----------------------------------------------------------------------------
-- Point-in-time record. Insert a new row whenever department/designation/
-- location/reports_to/employment_type changes. effective_to is null on the
-- current row and set when a newer row is inserted.
-- -----------------------------------------------------------------------------
create table if not exists public.employee_employment_history (
  id                serial primary key,
  employee_id       uuid not null references public.employees(id) on delete cascade,
  effective_from    date not null,
  effective_to      date,
  department_id     int  references public.departments(id),
  designation_id    int  references public.designations(id),
  location_id       int  references public.locations(id),
  reports_to        uuid references public.employees(id),
  employment_type   text not null,
  change_reason     text,                  -- 'new_hire','promotion','transfer','role_change','reassignment','exit'
  created_at        timestamptz not null default now(),
  created_by        uuid references public.users(id) on delete set null
);

create index if not exists idx_eeh_employee on public.employee_employment_history(employee_id, effective_from desc);

-- -----------------------------------------------------------------------------
-- employee_documents
-- -----------------------------------------------------------------------------
create table if not exists public.employee_documents (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete cascade,
  doc_type        text not null,           -- 'pan','aadhaar','passport','offer_letter','appointment','experience','education','bank_proof','other'
  title           text,
  storage_path    text not null,           -- e.g. 'employee-docs/<employee_id>/<uuid>-<filename>'
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_at     timestamptz not null default now(),
  uploaded_by     uuid references public.users(id) on delete set null
);

create index if not exists idx_employee_documents_employee on public.employee_documents(employee_id);
create index if not exists idx_employee_documents_type     on public.employee_documents(doc_type);

-- -----------------------------------------------------------------------------
-- RLS — read for authenticated; writes via service-role only.
-- -----------------------------------------------------------------------------
alter table public.employees                    enable row level security;
alter table public.employee_employment_history  enable row level security;
alter table public.employee_documents           enable row level security;

drop policy if exists "auth_read_employees" on public.employees;
create policy "auth_read_employees" on public.employees
  for select to authenticated using (true);

drop policy if exists "auth_read_employee_employment_history" on public.employee_employment_history;
create policy "auth_read_employee_employment_history" on public.employee_employment_history
  for select to authenticated using (true);

drop policy if exists "auth_read_employee_documents" on public.employee_documents;
create policy "auth_read_employee_documents" on public.employee_documents
  for select to authenticated using (true);
