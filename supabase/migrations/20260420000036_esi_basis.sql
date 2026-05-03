-- =============================================================================
-- Statutory config — choose ESI calculation basis (Gross vs Basic)
-- =============================================================================
-- ESI is normally % of monthly Gross, but some employers prefer to compute it
-- on Basic (the same wage definition used for PF). The choice is locked per
-- statutory_config period — once a period is in force we don't flip it.
--
-- All existing rows default to 'gross' (current behaviour, no payroll change).
-- New periods rolled via /settings/statutory pick the basis explicitly on
-- creation; the field is then immutable for that period.
-- =============================================================================

alter table public.statutory_config
  add column if not exists esi_basis text not null default 'gross'
    check (esi_basis in ('gross', 'basic'));

comment on column public.statutory_config.esi_basis is
  'ESI computation basis: ''gross'' (default; % of monthly gross) or ''basic'' (% of Basic). Locked once the period is created.';
