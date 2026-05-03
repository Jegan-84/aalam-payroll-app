-- =============================================================================
-- Timesheet — track WFH vs WFO per entry
-- =============================================================================
-- Each entry now records whether the work was done from office or from home.
-- Default is WFO so existing rows back-fill cleanly.
-- The unique grid key is widened to include work_mode so an employee can have
-- two rows for the same (project, activity, task) — one WFH, one WFO — and
-- split hours across them.
-- =============================================================================

alter table public.timesheet_entries
  add column if not exists work_mode text not null default 'WFO'
  check (work_mode in ('WFH', 'WFO'));

drop index if exists public.timesheet_entries_grid_key;
create unique index timesheet_entries_grid_key
  on public.timesheet_entries (
    employee_id, entry_date, project_id, activity_type_id,
    coalesce(task, ''), work_mode
  );

comment on column public.timesheet_entries.work_mode is
  'WFH = work from home, WFO = work from office. Part of the entry identity — a row with the same project/activity/task but a different mode is a separate entry.';

-- Optional: track default mode on the active timer so newly-stopped timer
-- sessions inherit the mode the employee was working in.
alter table public.active_timers
  add column if not exists work_mode text not null default 'WFO'
  check (work_mode in ('WFH', 'WFO'));
