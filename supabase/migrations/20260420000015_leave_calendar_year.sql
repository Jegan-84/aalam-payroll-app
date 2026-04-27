-- =============================================================================
-- Leave policy Phase 1 — Calendar year + CL→PL + half-yearly cadence
-- =============================================================================
-- Three changes, combined because they touch the same rows:
--   1. Rename CL (Casual Leave) to PL (Paid Leave). Existing CL rows keep their
--      balances — we just update the code + name.
--   2. Widen `leave_types.accrual_type` to accept `'half_yearly'`. SL and PL
--      switch to half-yearly: 6 credited on Jan 1, 6 more on Jul 1.
--   3. EL goes from 15 → 6/year annual quota. Max balance stays 45.
--   4. Add a `COMP_OFF` leave type (V1 is marker-only; per-grant expiry comes in Phase 4).
--
-- NOTE: the existing `leave_balances.fy_start` column keeps its name, but from
-- now on LEAVE balances use calendar-year periods (Jan 1 → Dec 31), while the
-- payroll/tax FY stays Apr–Mar. The `resolveLeaveYear` helper in
-- `lib/leave/year.ts` is the single source of truth for this distinction.
-- =============================================================================

-- Widen the accrual_type check to allow 'half_yearly'.
alter table public.leave_types drop constraint if exists leave_types_accrual_type_check;
alter table public.leave_types
  add constraint leave_types_accrual_type_check
    check (accrual_type in ('annual', 'monthly', 'half_yearly', 'none'));

-- Rename CL → PL (preserve any existing balances attached to the same id).
update public.leave_types
  set code = 'PL',
      name = 'Paid Leave',
      accrual_type = 'half_yearly',
      monthly_accrual_days = 0,
      annual_quota_days = 12
  where code = 'CL';

-- SL becomes half-yearly too (6 + 6).
update public.leave_types
  set accrual_type = 'half_yearly',
      monthly_accrual_days = 0,
      annual_quota_days = 12
  where code = 'SL';

-- EL — 6/year, no monthly accrual. EL is "banked" from year-end PL transfers.
update public.leave_types
  set accrual_type = 'annual',
      monthly_accrual_days = 0,
      annual_quota_days = 6,
      max_balance_days = 12,
      carry_forward_max_days = 6
  where code = 'EL';

-- Compensatory off — 0 annual quota (grants come via comp_off_grants in Phase 4).
insert into public.leave_types
  (code, name, is_paid, annual_quota_days, accrual_type, carry_forward_max_days,
   encashable_on_exit, includes_weekends, display_order,
   monthly_accrual_days, max_balance_days)
values
  ('COMP_OFF', 'Compensatory Off', true, 0, 'none', 0, false, false, 25, 0, 30)
on conflict (code) do update set
  name = excluded.name,
  accrual_type = excluded.accrual_type,
  annual_quota_days = excluded.annual_quota_days,
  is_paid = excluded.is_paid,
  monthly_accrual_days = excluded.monthly_accrual_days,
  max_balance_days = excluded.max_balance_days;
