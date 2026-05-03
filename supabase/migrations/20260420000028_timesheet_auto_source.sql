-- =============================================================================
-- Allow 'auto' as a source for timesheet entries — used when the system
-- pre-fills leave / holiday rows from leave_applications + holidays.
-- The employee can still edit these rows freely (e.g. they actually worked
-- during a leave day, so reduce PL hours and add a DEV row alongside).
-- =============================================================================

alter table public.timesheet_entries
  drop constraint if exists timesheet_entries_source_check;
alter table public.timesheet_entries
  add constraint timesheet_entries_source_check
    check (source in ('manual', 'timer', 'auto'));
