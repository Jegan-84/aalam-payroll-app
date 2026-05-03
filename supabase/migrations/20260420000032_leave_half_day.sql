-- =============================================================================
-- Half-day leave applications
-- =============================================================================
-- A leave application can now mark itself as half-day when from_date = to_date.
-- The day count is 0.5 instead of 1 in that case.
--
-- Constraint: is_half_day is only valid when from_date = to_date. We enforce
-- this at the table level so a multi-day application can't accidentally claim
-- to be half-day.
-- =============================================================================

alter table public.leave_applications
  add column if not exists is_half_day boolean not null default false;

alter table public.leave_applications
  drop constraint if exists leave_applications_half_day_single_date;
alter table public.leave_applications
  add constraint leave_applications_half_day_single_date
    check (is_half_day = false or from_date = to_date);

comment on column public.leave_applications.is_half_day is
  'When true, the leave is for half a day (0.5 day deducted from balance instead of 1). Requires from_date = to_date.';
