-- =============================================================================
-- Employee self-service — profile edit toggle + photo + document verification
-- =============================================================================
-- Three changes that together let employees fill in their own onboarding details:
--
-- 1. employees.profile_edit_enabled — HR/Admin flips this per employee. While
--    true, the ESS profile page becomes editable; flipping false locks it back
--    to read-only. Tax regime is NEVER editable from ESS regardless of flag.
--
-- 2. employees.photo_* — canonical profile photo (single image per employee,
--    stored in the 'employee-docs' bucket). Replacing it overwrites in storage.
--
-- 3. employee_documents.verified_* — HR can mark a doc verified after eyeballing
--    it. ESS shows the badge so the employee knows their submission was accepted.
-- =============================================================================

alter table public.employees
  add column if not exists profile_edit_enabled boolean not null default false,
  add column if not exists photo_storage_path   text,
  add column if not exists photo_uploaded_at    timestamptz;

comment on column public.employees.profile_edit_enabled is
  'When true, the employee can edit their own personal/contact/address/statutory/bank fields from /me/profile. Tax regime stays HR-only. Toggled by HR or Admin from the employee detail page.';

alter table public.employee_documents
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.users(id) on delete set null;

comment on column public.employee_documents.verified_at is
  'Set when HR verifies the uploaded document. Null = pending verification.';

create index if not exists idx_employee_documents_verified
  on public.employee_documents (employee_id) where verified_at is null;
