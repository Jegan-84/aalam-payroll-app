-- =============================================================================
-- Phase 7 — Projects master + per-employee project assignment
-- =============================================================================
-- Employees can have one primary project and zero or more secondary projects.
-- Holiday lookup keys off the primary project (done in migration 00021).
-- =============================================================================

create table if not exists public.projects (
  id          serial primary key,
  code        text not null unique,
  name        text not null,
  client      text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One primary project per employee (optional — HR / finance staff may have none).
alter table public.employees
  add column if not exists primary_project_id int references public.projects(id) on delete set null;

create index if not exists idx_employees_primary_project on public.employees(primary_project_id);

-- Secondary projects: many-to-many (no date range — current-only).
create table if not exists public.employee_secondary_projects (
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_id  int  not null references public.projects(id)  on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (employee_id, project_id)
);

create index if not exists idx_esp_project on public.employee_secondary_projects(project_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.projects enable row level security;
drop policy if exists "auth_read_projects" on public.projects;
create policy "auth_read_projects" on public.projects
  for select to authenticated using (true);

alter table public.employee_secondary_projects enable row level security;
drop policy if exists "auth_read_esp" on public.employee_secondary_projects;
create policy "auth_read_esp" on public.employee_secondary_projects
  for select to authenticated using (true);

comment on table public.projects is 'Client / delivery projects employees are tagged to. Holiday calendars key off the primary project.';
comment on column public.employees.primary_project_id is
  'Primary project. Drives the employee-specific holiday calendar.';
