-- =============================================================================
-- Comp-off requests — two-stage approval (reporting manager → HR)
-- =============================================================================
-- Old flow: employee submits (status='submitted') → HR approves directly,
-- which created a comp_off_grants row and credited the balance.
-- New flow:
--   submitted         — awaiting reporting manager
--   manager_approved  — manager OK'd, awaiting HR (NO grant yet, NO balance credit)
--   approved          — HR final approval; only NOW the comp_off_grants row is
--                       inserted and the balance is recomputed
--   rejected          — either stage rejected
--   cancelled         — employee cancelled (any pre-approval stage)
--
-- Existing `decided_*` columns capture the HR-stage decision (terminal).
-- New `manager_*` columns capture stage 1.
-- =============================================================================

alter table public.comp_off_requests
  add column if not exists manager_approved_at  timestamptz,
  add column if not exists manager_approved_by  uuid references public.users(id) on delete set null,
  add column if not exists manager_decision_note text;

alter table public.comp_off_requests
  drop constraint if exists comp_off_requests_status_check;

alter table public.comp_off_requests
  add constraint comp_off_requests_status_check
  check (status in ('submitted', 'manager_approved', 'approved', 'rejected', 'cancelled'));

comment on column public.comp_off_requests.manager_approved_at is
  'Timestamp when the reporting manager approved the request. Stage 1 of 2.';
comment on column public.comp_off_requests.manager_approved_by is
  'auth user id of the reporting manager who approved. Stage 1 of 2.';
comment on column public.comp_off_requests.manager_decision_note is
  'Manager note attached to their approve/reject decision.';
