-- =============================================================================
-- Allow employees without a work_email — for staff who don't use the portal.
-- =============================================================================
-- The unique constraint stays. Postgres treats NULL as distinct, so multiple
-- employees can have NULL work_email without violating uniqueness. Once HR
-- decides to give them portal access, set the email and invite a user from
-- /users — the auto-link logic will tie them together.
-- =============================================================================

alter table public.employees
  alter column work_email drop not null;

comment on column public.employees.work_email is
  'Company email for portal access. NULL = no ESS access (manual HR-managed only). Set later + invite a user from /users to enable login.';
