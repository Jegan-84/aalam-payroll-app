-- =============================================================================
-- Raw biometric punches pulled from ESSL / ZKTeco devices
-- =============================================================================
-- One row per punch event reported by a device. We store the raw biometric
-- user id (the value programmed into the device for that finger / face) so we
-- can investigate "unknown user" cases. The real employee is resolved at
-- ingest time via employees.biometric_id; punches without a match keep
-- employee_id NULL until HR updates the mapping.
--
-- Idempotency: (device_id, biometric_user_id, punch_time) is unique. Re-pulling
-- the same device window is safe.
-- =============================================================================

create table if not exists public.device_punches (
  id                 uuid primary key default gen_random_uuid(),
  device_id          text not null,
  biometric_user_id  text not null,
  employee_id        uuid references public.employees(id) on delete set null,
  punch_time         timestamptz not null,
  raw_status         int,
  raw_punch          int,
  source             text not null default 'zklib',
  created_at         timestamptz not null default now(),
  unique (device_id, biometric_user_id, punch_time)
);

create index if not exists idx_device_punches_employee_time
  on public.device_punches(employee_id, punch_time desc);
create index if not exists idx_device_punches_device_time
  on public.device_punches(device_id, punch_time desc);
create index if not exists idx_device_punches_unknown
  on public.device_punches(biometric_user_id)
  where employee_id is null;
