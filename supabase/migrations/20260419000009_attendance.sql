-- =============================================================================
-- Module 4 — Attendance
-- =============================================================================
-- One row per employee per calendar day in a month that is being tracked.
-- Payroll freeze flips `locked=true` so cells can't be changed afterwards.
--
-- Statuses:
--   P      Present (paid work day)
--   A      Absent, unapproved (goes to LOP)
--   H      Half-day present (0.5 paid / 0.5 LOP unless LOP was approved)
--   HOL    Public holiday (paid)
--   WO     Weekly off (paid)
--   LEAVE  Paid leave (references leave_types)
--   LOP    Approved loss of pay
--   NA     Not applicable (pre-joining / post-exit)
-- =============================================================================

-- Weekly off configuration on organization (0=Sunday … 6=Saturday)
alter table public.organizations
  add column if not exists weekly_off_days smallint[] not null default '{0}'::smallint[];

create table if not exists public.attendance_days (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id) on delete cascade,
  attendance_date  date not null,
  status           text not null check (status in ('P','A','H','HOL','WO','LEAVE','LOP','NA')),
  leave_type_id    int  references public.leave_types(id) on delete restrict,
  note             text,
  locked           boolean not null default false,

  created_at       timestamptz not null default now(),
  created_by       uuid references public.users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.users(id) on delete set null,

  unique (employee_id, attendance_date),
  constraint chk_leave_type_required
    check (status not in ('LEAVE') or leave_type_id is not null)
);

create index if not exists idx_att_employee_date on public.attendance_days(employee_id, attendance_date);
create index if not exists idx_att_date_status   on public.attendance_days(attendance_date, status);
create index if not exists idx_att_locked        on public.attendance_days(locked) where locked;

drop trigger if exists set_updated_at on public.attendance_days;
create trigger set_updated_at before update on public.attendance_days
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.attendance_days enable row level security;

drop policy if exists "auth_read_attendance" on public.attendance_days;
create policy "auth_read_attendance" on public.attendance_days
  for select to authenticated using (true);
