-- =============================================================================
-- Per-employee SHIFT allowance flag + amount
-- =============================================================================
-- When `shift_applicable = true`, the payroll engine adds a SHIFT earning line
-- on the employee's monthly payslip equal to `shift_allowance_monthly`, prorated
-- by paid_days / days_in_month (same convention as BASIC / HRA).
--
-- Default amount is ₹5,000; it can be edited per employee on the employee form.
-- HR can still Skip / Override the SHIFT line for a single cycle via the
-- Adjustments panel (same pattern as LUNCH).
-- =============================================================================

alter table public.employees
  add column if not exists shift_applicable boolean not null default false;

alter table public.employees
  add column if not exists shift_allowance_monthly numeric(14,2) not null default 5000
    check (shift_allowance_monthly >= 0);
