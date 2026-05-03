-- =============================================================================
-- Timesheet module
-- =============================================================================
-- Four tables:
--   1. activity_types       — master list (DEV / BUG / MEETING / DOCS / ...)
--   2. timesheet_entries    — one row per (employee, day, project, activity, task)
--   3. timesheet_weeks      — weekly submission state (draft / submitted / approved / rejected)
--   4. active_timers        — single running timer per employee
--
-- Approvals run via employees.reports_to.
-- Hours flow: employee logs entries → submits week → reports_to approves.
-- =============================================================================

-- 1. activity_types --------------------------------------------------------
create table if not exists public.activity_types (
  id                  serial primary key,
  code                text not null unique,
  name                text not null,
  is_billable_default boolean not null default true,
  is_active           boolean not null default true,
  display_order       int not null default 100,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

insert into public.activity_types (code, name, is_billable_default, display_order) values
  ('DEV',      'Development',         true,  10),
  ('BUG',      'Bug fix',             true,  20),
  ('CR',       'Change request',      true,  30),
  ('MEETING',  'Meeting',             true,  40),
  ('DOCS',     'Documentation',       true,  50),
  ('LEARNING', 'Training / learning', false, 60),
  ('OTHER',    'Other',               true,  90)
on conflict (code) do nothing;

-- 2. timesheet_entries -----------------------------------------------------
create table if not exists public.timesheet_entries (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  project_id        int not null references public.projects(id),
  activity_type_id  int not null references public.activity_types(id),
  entry_date        date not null,
  hours             numeric(4,2) not null check (hours >= 0 and hours <= 24),
  task              text,
  description       text,
  is_billable       boolean not null default true,
  source            text not null default 'manual' check (source in ('manual','timer')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- One row per (employee, day, project, activity, task). Keeps the grid tidy
-- and lets the timer's stop action upsert without creating duplicates.
create unique index if not exists timesheet_entries_grid_key
  on public.timesheet_entries (
    employee_id, entry_date, project_id, activity_type_id,
    coalesce(task, '')
  );
create index if not exists idx_timesheet_entries_employee_week
  on public.timesheet_entries (employee_id, entry_date desc);
create index if not exists idx_timesheet_entries_project_date
  on public.timesheet_entries (project_id, entry_date desc);

-- 3. timesheet_weeks -------------------------------------------------------
create table if not exists public.timesheet_weeks (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete cascade,
  week_start      date not null,                                -- Monday
  status          text not null default 'draft'
                    check (status in ('draft','submitted','approved','rejected')),
  total_hours     numeric(5,2) not null default 0,
  submitted_at    timestamptz,
  approved_at     timestamptz,
  decided_by      uuid references public.users(id),
  decision_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (employee_id, week_start)
);
create index if not exists idx_timesheet_weeks_status
  on public.timesheet_weeks (status, week_start desc);

-- 4. active_timers ---------------------------------------------------------
-- One row per employee. When stopped, the row is deleted and the elapsed
-- time is upserted into timesheet_entries.
create table if not exists public.active_timers (
  employee_id      uuid primary key references public.employees(id) on delete cascade,
  project_id       int not null references public.projects(id),
  activity_type_id int not null references public.activity_types(id),
  task             text,
  description      text,
  started_at       timestamptz not null default now()
);

comment on table public.active_timers is
  'Single running timer per employee. On stop, elapsed time is rounded to 0.25h and upserted into timesheet_entries.';
