-- =============================================================================
-- PeopleStack — Master data seed
-- Idempotent: safe to re-run. Uses ON CONFLICT DO NOTHING / UPDATE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into public.roles (code, name, description) values
  ('admin',    'Administrator',  'Full access, including settings and payroll freeze.'),
  ('hr',       'HR',             'Employee, leave, attendance management.'),
  ('payroll',  'Payroll',        'Run and review payroll; generate statutory reports.'),
  ('employee', 'Employee',       'Self-service: view payslips, apply leave.')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Organization (single row for Aalam — update via settings UI)
-- -----------------------------------------------------------------------------
insert into public.organizations (
  legal_name, display_name, pt_state_code, state, country, financial_year_start_month
) values (
  'Aalam Soft Private Limited', 'Aalam', 'TN', 'Tamil Nadu', 'India', 4
) on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Pay components (matches the CTC template in the specification sheet)
-- calculation_type rules are executed by the payroll engine, not the DB.
-- -----------------------------------------------------------------------------
insert into public.pay_components
  (code, name, kind, taxable, include_in_gross, calculation_type, percent_value, cap_amount, display_order)
values
  -- Earnings
  ('BASIC',     'Basic',           'earning',   true,  true,  'percent_of_gross', 50.0000, null,   10),
  ('HRA',       'HRA',             'earning',   true,  true,  'percent_of_basic', 50.0000, null,   20),
  ('CONV',      'Conveyance',      'earning',   true,  true,  'percent_of_basic', 10.0000, 800,    30),
  ('OTHERALLOW','Other Allowance', 'earning',   true,  true,  'balancing',        null,    null,   40),
  -- Employee deductions
  ('PF_EE',     'PF (Employee)',   'deduction', false, false, 'formula',          null,    1800,   110),
  ('ESI_EE',    'ESI (Employee)',  'deduction', false, false, 'formula',          null,    null,   120),
  ('PT',        'Professional Tax','deduction', false, false, 'formula',          null,    null,   130),
  ('TDS',       'TDS',             'deduction', false, false, 'formula',          null,    null,   140),
  -- Employer retirals (not in gross, not in take-home)
  ('PF_ER',     'PF (Employer)',       'employer_retiral', false, false, 'formula',          null, 1800, 210),
  ('ESI_ER',    'ESI (Employer)',      'employer_retiral', false, false, 'formula',          null, null, 220),
  ('GRATUITY',  'Gratuity',            'employer_retiral', false, false, 'percent_of_basic', 4.8100, null, 230),
  ('MEDINS',    'Medical Insurance',   'employer_retiral', false, false, 'fixed',            null,  500,  240),
  -- Reimbursements
  ('INTERNET',  'Internet Reimbursement','reimbursement',  false, false, 'fixed',            null, 1000, 310),
  ('TRAINING',  'Training / Certification','reimbursement',false, false, 'fixed',            null, 1000, 320),
  -- Variable
  ('VP',        'Variable Pay',        'variable',          true,  false, 'percent_of_gross', 10.0000, null, 410)
on conflict (code) do update set
  name = excluded.name,
  kind = excluded.kind,
  taxable = excluded.taxable,
  include_in_gross = excluded.include_in_gross,
  calculation_type = excluded.calculation_type,
  percent_value = excluded.percent_value,
  cap_amount = excluded.cap_amount,
  display_order = excluded.display_order;

-- -----------------------------------------------------------------------------
-- Tamil Nadu Professional Tax slabs (half-yearly)
-- Source: TN Municipal / Corporation PT schedule, current as of 2026.
-- Engine divides amount by 6 for monthly deduction (typical: ~208/month top slab).
-- -----------------------------------------------------------------------------
insert into public.pt_slabs
  (state_code, effective_from, effective_to, half_year_gross_min, half_year_gross_max, half_year_pt_amount)
values
  ('TN', '2024-04-01', null,         0,      21000,    0),
  ('TN', '2024-04-01', null,     21001,      30000,  135),
  ('TN', '2024-04-01', null,     30001,      45000,  315),
  ('TN', '2024-04-01', null,     45001,      60000,  690),
  ('TN', '2024-04-01', null,     60001,      75000, 1025),
  ('TN', '2024-04-01', null,     75001,       null, 1250)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Tax regimes
-- -----------------------------------------------------------------------------
insert into public.tax_regimes (code, name, description) values
  ('NEW', 'New Regime',  'Default from FY 2023-24. Lower rates, limited exemptions.'),
  ('OLD', 'Old Regime',  'Higher rates with HRA, 80C, 80D, etc. exemptions.')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Income Tax slabs — FY 2026-27 (AY 2027-28)
-- NEW regime (Finance Act 2025): 0/4L, 5/4-8L, 10/8-12L, 15/12-16L, 20/16-20L, 25/20-24L, 30/>24L
-- OLD regime (unchanged): 0/2.5L, 5/2.5-5L, 20/5-10L, 30/>10L
-- Surcharge + 4% cess apply; configured in tax_config / tax_surcharge_slabs.
-- -----------------------------------------------------------------------------

-- NEW regime
insert into public.tax_slabs (regime_id, fy_start, fy_end, taxable_income_min, taxable_income_max, rate_percent)
select r.id, '2026-04-01'::date, '2027-03-31'::date, s.min, s.max, s.rate
from public.tax_regimes r,
     (values
        (       0::numeric,   400000::numeric,  0.0),
        (  400001::numeric,   800000::numeric,  5.0),
        (  800001::numeric,  1200000::numeric, 10.0),
        ( 1200001::numeric,  1600000::numeric, 15.0),
        ( 1600001::numeric,  2000000::numeric, 20.0),
        ( 2000001::numeric,  2400000::numeric, 25.0),
        ( 2400001::numeric,       null::numeric, 30.0)
     ) as s(min, max, rate)
where r.code = 'NEW'
on conflict do nothing;

-- OLD regime
insert into public.tax_slabs (regime_id, fy_start, fy_end, taxable_income_min, taxable_income_max, rate_percent)
select r.id, '2026-04-01'::date, '2027-03-31'::date, s.min, s.max, s.rate
from public.tax_regimes r,
     (values
        (       0::numeric,   250000::numeric,  0.0),
        (  250001::numeric,   500000::numeric,  5.0),
        (  500001::numeric,  1000000::numeric, 20.0),
        ( 1000001::numeric,       null::numeric, 30.0)
     ) as s(min, max, rate)
where r.code = 'OLD'
on conflict do nothing;

-- Tax configuration (std deduction, 87A rebate, cess)
insert into public.tax_config (regime_id, fy_start, fy_end, standard_deduction, rebate_87a_income_limit, rebate_87a_max_amount, cess_percent)
select r.id, '2026-04-01'::date, '2027-03-31'::date, 75000, 1200000, 60000, 4.0
from public.tax_regimes r where r.code = 'NEW'
on conflict (regime_id, fy_start) do nothing;

insert into public.tax_config (regime_id, fy_start, fy_end, standard_deduction, rebate_87a_income_limit, rebate_87a_max_amount, cess_percent)
select r.id, '2026-04-01'::date, '2027-03-31'::date, 50000, 500000, 12500, 4.0
from public.tax_regimes r where r.code = 'OLD'
on conflict (regime_id, fy_start) do nothing;

-- Surcharge (applies to NEW regime — capped at 25% for super-rich per Finance Act 2023)
insert into public.tax_surcharge_slabs (regime_id, fy_start, fy_end, taxable_income_min, taxable_income_max, surcharge_percent)
select r.id, '2026-04-01'::date, '2027-03-31'::date, s.min, s.max, s.rate
from public.tax_regimes r,
     (values
        (  5000001::numeric,  10000000::numeric, 10.0),
        ( 10000001::numeric,  20000000::numeric, 15.0),
        ( 20000001::numeric,        null::numeric, 25.0)
     ) as s(min, max, rate)
where r.code = 'NEW';

insert into public.tax_surcharge_slabs (regime_id, fy_start, fy_end, taxable_income_min, taxable_income_max, surcharge_percent)
select r.id, '2026-04-01'::date, '2027-03-31'::date, s.min, s.max, s.rate
from public.tax_regimes r,
     (values
        (  5000001::numeric,  10000000::numeric, 10.0),
        ( 10000001::numeric,  20000000::numeric, 15.0),
        ( 20000001::numeric,  50000000::numeric, 25.0),
        ( 50000001::numeric,        null::numeric, 37.0)
     ) as s(min, max, rate)
where r.code = 'OLD';

-- -----------------------------------------------------------------------------
-- Statutory config (EPF/ESI/Gratuity) — current effective rates
-- -----------------------------------------------------------------------------
insert into public.statutory_config (
  effective_from,
  epf_employee_percent, epf_employer_percent, epf_wage_ceiling, epf_max_monthly_contribution,
  esi_employee_percent, esi_employer_percent, esi_wage_ceiling,
  gratuity_percent
) values (
  '2024-04-01',
  12.000, 12.000, 15000, 1800,
   0.750,  3.250, 21000,
   4.810
) on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Leave types — common Indian defaults. Quotas editable via settings.
-- -----------------------------------------------------------------------------
insert into public.leave_types
  (code, name, is_paid, annual_quota_days, accrual_type, carry_forward_max_days, encashable_on_exit, display_order)
values
  ('PL',  'Paid Leave',      true,  12.00, 'half_yearly', 0,   false, 10),
  ('SL',  'Sick Leave',      true,  12.00, 'half_yearly', 0,   false, 20),
  ('EL',  'Earned Leave',    true,   6.00, 'annual',      6,   true,  30),
  ('COMP_OFF', 'Compensatory Off', true, 0, 'none',       0,   false, 25),
  ('LOP', 'Loss of Pay',     false,  0.00, 'none',        0,   false, 99)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Departments & designations — starter set (editable later)
-- -----------------------------------------------------------------------------
insert into public.departments (code, name) values
  ('ENG', 'Engineering'),
  ('OPS', 'Operations'),
  ('HR',  'Human Resources'),
  ('FIN', 'Finance'),
  ('SAL', 'Sales')
on conflict (code) do nothing;

insert into public.designations (code, name, grade) values
  ('SE',  'Software Engineer',         'L2'),
  ('SSE', 'Senior Software Engineer',  'L3'),
  ('TL',  'Tech Lead',                 'L4'),
  ('MGR', 'Manager',                   'L5')
on conflict (code) do nothing;

insert into public.locations (code, name, city, state) values
  ('CHN-HO', 'Chennai HO', 'Chennai', 'Tamil Nadu')
on conflict (code) do nothing;
