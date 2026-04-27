-- =============================================================================
-- Reimbursement claims — employees submit receipts, HR approves, paid in payroll
-- =============================================================================
-- Flow:
--   pending   — employee submitted, awaiting HR review
--   approved  — HR approved; ready to be paid in the next payroll cycle
--   rejected  — HR rejected (with a note)
--   paid      — folded into an approved payroll cycle as an earning line
--
-- Engine integration (see lib/payroll/actions.ts):
--   computeCycleAction picks up all `approved` claims per employee and adds
--   a REIMB_<short-id> earning line. approveCycleAction marks them `paid` and
--   sets `paid_in_cycle_id`. reopenCycleAction reverts them back to `approved`.
-- =============================================================================

create table if not exists public.reimbursement_claims (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id) on delete cascade,

  category         text not null
                     check (category in ('fuel','medical','internet','telephone','travel','books','meals','other')),
  sub_category     text,                           -- free text: "Airport taxi Delhi", "Broadband Jan", etc.
  claim_date       date not null,                  -- when the expense was incurred
  amount           numeric(14,2) not null check (amount > 0),

  -- Attached receipt (Supabase Storage)
  file_path        text not null,
  file_name        text not null,
  file_size_bytes  int,
  mime_type        text,

  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected','paid')),
  review_notes     text,

  submitted_at     timestamptz not null default now(),
  submitted_by     uuid references public.users(id) on delete set null,
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.users(id) on delete set null,

  -- When this claim was folded into a payroll cycle.
  paid_in_cycle_id uuid references public.payroll_cycles(id) on delete set null,
  paid_at          timestamptz,

  updated_at       timestamptz not null default now()
);

create index if not exists idx_reimb_employee   on public.reimbursement_claims(employee_id);
create index if not exists idx_reimb_status     on public.reimbursement_claims(status);
create index if not exists idx_reimb_queue      on public.reimbursement_claims(status, submitted_at desc)
  where status = 'pending';
create index if not exists idx_reimb_approved_unpaid
  on public.reimbursement_claims(employee_id)
  where status = 'approved';
create index if not exists idx_reimb_cycle      on public.reimbursement_claims(paid_in_cycle_id);

drop trigger if exists set_updated_at on public.reimbursement_claims;
create trigger set_updated_at before update on public.reimbursement_claims
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS + Storage bucket
-- -----------------------------------------------------------------------------
alter table public.reimbursement_claims enable row level security;

drop policy if exists "auth_read_reimbursement_claims" on public.reimbursement_claims;
create policy "auth_read_reimbursement_claims" on public.reimbursement_claims
  for select to authenticated using (true);

insert into storage.buckets (id, name, public)
  values ('reimbursement-receipts', 'reimbursement-receipts', false)
  on conflict (id) do nothing;

-- Private bucket (public=false) + no anon SELECT/INSERT policy = denied by default.
-- All reads and writes go through server actions using the service-role admin
-- client, which bypasses RLS. Signed URLs are minted by /api/reimbursement/[id].
