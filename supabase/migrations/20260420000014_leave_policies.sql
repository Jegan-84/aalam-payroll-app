-- =============================================================================
-- Leave policy engine — accrual rates, balance caps, carry-forward honouring
-- =============================================================================
-- Today `leave_types` already has `annual_quota_days`, `accrual_type`, and
-- `carry_forward_max_days`. We add:
--   - `monthly_accrual_days`   — used when accrual_type = 'monthly' (e.g. 1.25)
--   - `max_balance_days`       — absolute cap on the running balance (null = uncapped)
--
-- And on `leave_balances`:
--   - `last_accrued_yearmonth` — 'YYYY-MM' marker so monthly accrual is idempotent
--
-- The seed-FY action becomes policy-aware:
--   annual types → opening_balance = min(annual_quota_days + carry_forward, max_balance)
--   monthly types → opening_balance = 0, accrued fills over the year
--   carry_forward from the prior FY is capped at `carry_forward_max_days`.
-- =============================================================================

alter table public.leave_types
  add column if not exists monthly_accrual_days numeric(6,3) not null default 0
    check (monthly_accrual_days >= 0);

alter table public.leave_types
  add column if not exists max_balance_days numeric(6,2)
    check (max_balance_days is null or max_balance_days >= 0);

alter table public.leave_balances
  add column if not exists last_accrued_yearmonth text;

create index if not exists idx_lbal_accrual_pending
  on public.leave_balances(employee_id, leave_type_id, fy_start);

-- Sensible defaults for seeded types.
update public.leave_types set monthly_accrual_days = 1.25 where code = 'CL';  -- 15 days / 12 months
update public.leave_types set monthly_accrual_days = 1.00 where code = 'SL';  -- 12 days / 12 months
update public.leave_types set monthly_accrual_days = 1.25, max_balance_days = 45 where code = 'EL';

comment on column public.leave_types.monthly_accrual_days is
  'Days added to `accrued` each month when accrual_type = monthly. Typical: annual_quota ÷ 12.';
comment on column public.leave_types.max_balance_days is
  'Hard cap on current_balance. Accrual stops once the balance hits this cap. NULL = uncapped.';
comment on column public.leave_balances.last_accrued_yearmonth is
  'Marker "YYYY-MM" to make monthly accrual idempotent.';
