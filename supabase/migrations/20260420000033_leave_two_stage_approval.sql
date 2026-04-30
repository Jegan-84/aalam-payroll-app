-- =============================================================================
-- Leave applications — two-stage approval (reporting manager → HR)
-- =============================================================================
-- Old flow: employee submits (status='pending') → admin/HR approves directly.
-- New flow:
--   pending           — submitted, awaiting reporting manager
--   manager_approved  — reporting manager OK'd, awaiting HR final review
--   approved          — HR final approval (balance deducts, attendance writes)
--   rejected          — either stage rejected
--   cancelled         — employee cancelled
--
-- The existing `reviewed_at / reviewed_by / review_notes` columns capture the
-- HR-stage decision (terminal). We add `manager_*` columns for the first stage.
-- =============================================================================

alter table public.leave_applications
  add column if not exists manager_approved_at  timestamptz,
  add column if not exists manager_approved_by  uuid references public.users(id) on delete set null,
  add column if not exists manager_decision_note text;

-- Widen the status check to accept the intermediate state.
alter table public.leave_applications
  drop constraint if exists leave_applications_status_check;

alter table public.leave_applications
  add constraint leave_applications_status_check
  check (status in ('pending','manager_approved','approved','rejected','cancelled'));

comment on column public.leave_applications.manager_approved_at is
  'Timestamp when the reporting manager approved the application. Stage 1 of 2.';
comment on column public.leave_applications.manager_approved_by is
  'auth user id of the reporting manager who approved. Stage 1 of 2.';
comment on column public.leave_applications.manager_decision_note is
  'Manager note attached to their approve/reject decision.';
