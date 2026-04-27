-- =============================================================================
-- Loan perquisite — Section 17(2)(viii)
-- =============================================================================
-- Interest-free / concessional loans above ₹20,000 create a notional "perquisite"
-- for the employee under s.17(2)(viii) of the IT Act: the SBI prime lending
-- rate treated as if the employee were paying it. This is NOT money paid — it
-- increases the employee's taxable salary (and therefore TDS) without affecting
-- net pay, PF, or ESI.
--
-- Monthly formula (per loan, when outstanding > ₹20,000):
--   perquisite = outstanding_balance × (sbi_rate_percent / 100) / 12
--
-- Rendered on the payslip under a separate "Notional perquisites" section and
-- added to the annualised taxable gross before computing TDS.
-- =============================================================================

alter table public.organizations
  add column if not exists sbi_loan_perquisite_rate_percent numeric(5,2) not null default 9.25
    check (sbi_loan_perquisite_rate_percent >= 0);

comment on column public.organizations.sbi_loan_perquisite_rate_percent is
  'SBI prime lending rate used for s.17(2)(viii) perquisite valuation on employee loans. Update when RBI/SBI revises rates.';
