-- =============================================================================
-- Phase 5 — Year-end PL → EL top-up + leave encashment ledger
-- =============================================================================
-- On Dec 31 each year, HR runs the year-end conversion:
--   1. For each employee with PL > 0:
--        If EL == 0: move up to 6 PL days into EL (bank for emergencies)
--        Remaining PL → paid out as leave encashment
--   2. Encashment = leftover_PL_days × (last monthly Basic / 30)
--   3. A row is inserted into `leave_encashment_queue` — the next payroll
--      compute reads this and injects a LEAVE_ENC earning line.
--
-- The queue uses `status` to track lifecycle:
--   pending  — just converted, awaiting payroll pickup
--   paid     — included in a payroll cycle (cycle_id stamped)
--   cancelled — HR abandoned the conversion
-- =============================================================================

create table if not exists public.leave_encashment_queue (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references public.employees(id) on delete cascade,

  leave_year            int not null,       -- 2025, 2026 ...
  pl_days_converted_to_el  numeric(5,2) not null default 0,   -- 0..6
  pl_days_encashed      numeric(6,2) not null default 0,
  per_day_rate          numeric(12,2) not null default 0,     -- basic/30
  encashment_amount     numeric(14,2) not null default 0,

  status                text not null default 'pending'
                          check (status in ('pending','paid','cancelled')),
  paid_in_cycle_id      uuid references public.payroll_cycles(id) on delete set null,
  paid_at               timestamptz,

  notes                 text,
  created_at            timestamptz not null default now(),
  created_by            uuid references public.users(id) on delete set null,

  unique (employee_id, leave_year)
);

create index if not exists idx_leave_enc_pending
  on public.leave_encashment_queue(employee_id)
  where status = 'pending';

alter table public.leave_encashment_queue enable row level security;

drop policy if exists "auth_read_leave_encashment_queue" on public.leave_encashment_queue;
create policy "auth_read_leave_encashment_queue" on public.leave_encashment_queue
  for select to authenticated using (true);

comment on table public.leave_encashment_queue is
  'Year-end leave encashment ledger. One row per (employee, leave_year). Consumed by payroll compute to emit LEAVE_ENC earning lines; cycle approve marks paid.';
