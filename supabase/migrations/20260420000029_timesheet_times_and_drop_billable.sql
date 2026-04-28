-- =============================================================================
-- Timesheet — drop billable, add per-entry start/end times
-- =============================================================================
-- The timer is optional. For employees who prefer manual entry, they can now
-- record exact start_at / end_at timestamps per entry. If both are provided,
-- the server derives `hours` from the gap (rounded to 0.25h). Either or both
-- may be NULL — the existing "just hours" flow stays valid.
--
-- The is_billable concept is removed entirely from the timesheet module.
-- Reports continue to count totalHours per project/employee/activity, just
-- without the billable split.
-- =============================================================================

alter table public.timesheet_entries
  drop column if exists is_billable;

alter table public.activity_types
  drop column if exists is_billable_default;

alter table public.timesheet_entries
  add column if not exists start_at timestamptz,
  add column if not exists end_at   timestamptz;

alter table public.timesheet_entries
  drop constraint if exists timesheet_entries_time_range;
alter table public.timesheet_entries
  add constraint timesheet_entries_time_range
    check (start_at is null or end_at is null or end_at > start_at);

comment on column public.timesheet_entries.start_at is
  'Optional start of the work block. When both start_at and end_at are set, hours is auto-derived (rounded to 0.25h).';
comment on column public.timesheet_entries.end_at is
  'Optional end of the work block. Must be greater than start_at when both are set.';
