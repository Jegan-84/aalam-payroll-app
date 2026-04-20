-- =============================================================================
-- Per-employee LUNCH applicability flag
-- =============================================================================
-- When true, the payroll engine adds a LUNCH deduction of ₹250 to the
-- employee's monthly payslip by default. HR can still Skip it per cycle
-- (months the employee didn't take lunch) via the Adjustments panel.
-- =============================================================================

alter table public.employees
  add column if not exists lunch_applicable boolean not null default false;
