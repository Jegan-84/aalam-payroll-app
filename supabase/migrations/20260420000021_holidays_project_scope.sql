-- =============================================================================
-- Phase 8 — Project-scoped holidays
-- =============================================================================
-- holidays.project_id joins alongside location_id. An employee's effective
-- holidays are:
--   (project_id in (null, primary_project)) and
--   (location_id in (null, employee.location))
-- NULL on either side means "applies to everyone on that axis".
--
-- The old (holiday_date, location_id) unique constraint is dropped and
-- replaced with (holiday_date, location_id, project_id) so the same date can
-- exist in multiple calendars.
-- =============================================================================

alter table public.holidays
  add column if not exists project_id int references public.projects(id) on delete cascade;

alter table public.holidays
  drop constraint if exists holidays_holiday_date_location_id_key;

-- Postgres treats NULL as distinct in unique constraints — so (2026-01-26, null, null)
-- and (2026-01-26, null, 5) co-exist correctly.
create unique index if not exists holidays_unique_scope
  on public.holidays (holiday_date, coalesce(location_id, 0), coalesce(project_id, 0));

create index if not exists idx_holidays_project on public.holidays(project_id);

comment on column public.holidays.project_id is
  'When set, this holiday applies only to employees whose primary_project_id matches. NULL = all projects.';
