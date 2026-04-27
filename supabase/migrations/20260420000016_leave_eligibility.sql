-- =============================================================================
-- Leave policy Phase 3 — per-employment-type eligibility
-- =============================================================================
-- Each leave type can list which employment_types it applies to. NULL or an
-- empty array = "applies to all types" (backward-compatible).
--
-- Also adds 'probation' as a valid employment_type on employees + the history
-- table. HR uses this for new hires on probation — a common Indian practice
-- where the first 3–6 months get a reduced leave set.
-- =============================================================================

-- 1. Widen the employees.employment_type check to include 'probation'.
alter table public.employees
  drop constraint if exists employees_employment_type_check;
alter table public.employees
  add constraint employees_employment_type_check
    check (employment_type in ('full_time', 'probation', 'contract', 'intern', 'consultant'));

-- History snapshot table keeps its own string copy — no check to widen, it's free text.

-- 2. Add applicable_employment_types to leave_types. NULL = applies to everyone.
alter table public.leave_types
  add column if not exists applicable_employment_types text[];

-- 3. Seed defaults matching the stated policy:
--    Intern:       only SL + COMP_OFF + LOP
--    Probation:    SL + PL + COMP_OFF + LOP  (no EL until permanent)
--    Permanent & contract & consultant: all types
update public.leave_types set applicable_employment_types = null
  where code in ('PL', 'SL', 'LOP', 'COMP_OFF');
update public.leave_types
  set applicable_employment_types = array['full_time', 'contract', 'consultant']
  where code = 'EL';
-- Intern gets SL + COMP_OFF + LOP only.
update public.leave_types
  set applicable_employment_types = array['full_time', 'probation', 'contract', 'consultant']
  where code = 'PL';
update public.leave_types
  set applicable_employment_types = array['full_time', 'probation', 'contract', 'intern', 'consultant']
  where code in ('SL', 'COMP_OFF', 'LOP');

comment on column public.leave_types.applicable_employment_types is
  'Which employment_types are eligible for this leave. NULL = all. Used by seedFy + accrual actions to skip non-eligible combos.';
