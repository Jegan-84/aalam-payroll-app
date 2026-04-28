-- =============================================================================
-- Add biometric_id to employees
-- =============================================================================
-- Used by attendance integrations (punch / face / fingerprint devices) to map
-- a device-side identifier back to a PayFlow employee.
-- Optional. Unique when set so the same device id can't be assigned twice.
-- =============================================================================

alter table public.employees
  add column if not exists biometric_id text;

create unique index if not exists employees_biometric_id_key
  on public.employees(biometric_id)
  where biometric_id is not null;

comment on column public.employees.biometric_id is
  'Device-side identifier used by attendance integrations (punch / face / fingerprint). Unique when set.';
