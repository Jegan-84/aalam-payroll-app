-- =============================================================================
-- Employee Loans (V1 — interest-free)
-- =============================================================================
-- An employee loan is a lump-sum advance that is recovered via monthly payroll
-- EMIs until the outstanding balance reaches zero.
--
-- Lifecycle:
--   active      — EMIs being deducted on each cycle
--   closed      — outstanding_balance == 0 (fully recovered)
--   foreclosed  — employee paid off the remaining balance outside payroll
--   written_off — HR wrote off the remaining balance (exit without recovery)
--
-- Mechanics:
--   - `compute` on a cycle adds a LOAN_<short-id> deduction line per active
--     loan = min(emi_amount, outstanding_balance). The line is a snapshot.
--   - `approve` on the cycle writes loan_repayments rows and decrements
--     outstanding_balance. If the balance hits zero, the loan flips to closed.
--   - `reopen` reverses the repayments for the cycle and restores balances.
--
-- NOT in V1: interest, perquisite tax (s.17(2)(viii)), rescheduling.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- employee_loans
-- -----------------------------------------------------------------------------
create table if not exists public.employee_loans (
  id                     uuid primary key default gen_random_uuid(),
  employee_id            uuid not null references public.employees(id) on delete restrict,

  loan_type              text not null
                          check (loan_type in ('personal','housing','vehicle','advance','other')),
  loan_number            text,

  principal              numeric(14,2) not null check (principal > 0),
  interest_rate_percent  numeric(5,2)  not null default 0 check (interest_rate_percent >= 0),
  tenure_months          int           not null check (tenure_months > 0),
  emi_amount             numeric(14,2) not null check (emi_amount > 0),

  start_year             int           not null check (start_year between 2000 and 2100),
  start_month            int           not null check (start_month between 1 and 12),

  outstanding_balance    numeric(14,2) not null,
  total_paid             numeric(14,2) not null default 0,

  status                 text not null default 'active'
                          check (status in ('active','closed','foreclosed','written_off')),

  notes                  text,

  sanctioned_at          timestamptz not null default now(),
  sanctioned_by          uuid references public.users(id) on delete set null,
  closed_at              timestamptz,
  closed_by              uuid references public.users(id) on delete set null,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_loans_employee        on public.employee_loans(employee_id);
create index if not exists idx_loans_active_by_emp   on public.employee_loans(employee_id, status) where status = 'active';
create index if not exists idx_loans_status          on public.employee_loans(status);

drop trigger if exists set_updated_at on public.employee_loans;
create trigger set_updated_at before update on public.employee_loans
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- loan_repayments — one per (loan × approved cycle)
-- -----------------------------------------------------------------------------
create table if not exists public.loan_repayments (
  id              uuid primary key default gen_random_uuid(),
  loan_id         uuid not null references public.employee_loans(id) on delete cascade,
  cycle_id        uuid not null references public.payroll_cycles(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,

  amount_paid     numeric(14,2) not null check (amount_paid >= 0),
  running_balance numeric(14,2) not null,

  cycle_year      int not null,
  cycle_month     int not null,

  created_at      timestamptz not null default now(),

  unique (loan_id, cycle_id)
);

create index if not exists idx_loan_rep_loan    on public.loan_repayments(loan_id);
create index if not exists idx_loan_rep_cycle   on public.loan_repayments(cycle_id);
create index if not exists idx_loan_rep_emp_ym  on public.loan_repayments(employee_id, cycle_year, cycle_month);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.employee_loans   enable row level security;
alter table public.loan_repayments  enable row level security;

drop policy if exists "auth_read_employee_loans" on public.employee_loans;
create policy "auth_read_employee_loans" on public.employee_loans
  for select to authenticated using (true);

drop policy if exists "auth_read_loan_repayments" on public.loan_repayments;
create policy "auth_read_loan_repayments" on public.loan_repayments
  for select to authenticated using (true);
