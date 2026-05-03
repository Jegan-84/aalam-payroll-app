-- =============================================================================
-- Monthly Plan module
-- =============================================================================
-- Calendar-based intent tracker. Employees mark their plan for each day:
--   • WFH                  — work from home for the day
--   • FIRST_HALF_LEAVE     — out for the morning, working in the afternoon
--   • SECOND_HALF_LEAVE    — working in the morning, out for the afternoon
--   • FULL_DAY_LEAVE       — out all day
--
-- One plan entry per (employee, date). It's purely informational — no leave
-- balance is deducted automatically. Employees still file formal leave
-- applications via /me/leave/new for actual approval / balance impact.
--
-- Managers can view team plans for capacity / coverage planning.
-- =============================================================================

create table if not exists public.monthly_plans (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete cascade,
  plan_date       date not null,
  kind            text not null
                    check (kind in ('WFH', 'FIRST_HALF_LEAVE', 'SECOND_HALF_LEAVE', 'FULL_DAY_LEAVE')),
  leave_type_id   int references public.leave_types(id),  -- null for WFH
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (employee_id, plan_date)
);

create index if not exists idx_monthly_plans_employee_date
  on public.monthly_plans (employee_id, plan_date);

comment on table public.monthly_plans is
  'Employee monthly intent: WFH / leave (full / half) per day. Informational — does not auto-deduct leave balance.';
