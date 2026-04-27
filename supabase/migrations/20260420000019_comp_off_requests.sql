-- =============================================================================
-- Phase 6 — Comp Off request/approval workflow
-- =============================================================================
-- Previously comp_off_grants was populated directly by HR. Now employees raise
-- a request for a specific work_date; HR approves → a grant row is created
-- with expires_on = work_date + 30 days. (Approving late does not give the
-- employee bonus time — expiry is anchored on when they actually worked.)
-- =============================================================================

create table if not exists public.comp_off_requests (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,

  work_date      date not null,
  days_requested numeric(4,2) not null default 1 check (days_requested > 0 and days_requested <= 2),
  reason         text,

  status         text not null default 'submitted'
                   check (status in ('submitted', 'approved', 'rejected', 'cancelled')),
  decided_by     uuid references public.users(id) on delete set null,
  decided_at     timestamptz,
  decision_note  text,

  -- On approval, pointer to the grant this request produced.
  grant_id       uuid references public.comp_off_grants(id) on delete set null,

  created_at     timestamptz not null default now()
);

create index if not exists idx_compoff_req_pending
  on public.comp_off_requests(created_at desc)
  where status = 'submitted';

create index if not exists idx_compoff_req_employee
  on public.comp_off_requests(employee_id, created_at desc);

-- Back-link: grant can trace to the request it came from (optional — direct
-- HR grants leave this null).
alter table public.comp_off_grants
  add column if not exists request_id uuid references public.comp_off_requests(id) on delete set null;

create index if not exists idx_compoff_grant_request
  on public.comp_off_grants(request_id)
  where request_id is not null;

-- -----------------------------------------------------------------------------
-- RLS — everyone logged in can read; writes gated in app layer.
-- -----------------------------------------------------------------------------
alter table public.comp_off_requests enable row level security;

drop policy if exists "auth_read_comp_off_requests" on public.comp_off_requests;
create policy "auth_read_comp_off_requests" on public.comp_off_requests
  for select to authenticated using (true);

comment on table public.comp_off_requests is
  'Employee-initiated comp off request. On approval, a comp_off_grants row is created with expires_on = work_date + 30 days.';
