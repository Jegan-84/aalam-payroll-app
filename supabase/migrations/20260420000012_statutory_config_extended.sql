-- =============================================================================
-- Statutory config — CTC-structure percentages (BASIC%, HRA%, CONV%, CONV cap)
-- =============================================================================
-- Today the monthly payroll engine hard-codes the CTC split:
--   BASIC = 50% of monthly gross
--   HRA   = 50% of BASIC
--   CONV  = min(10% of BASIC, ₹800)
--
-- Those literals move to `statutory_config` so HR can adjust them via
-- /settings/statutory without a code change. Defaults keep the historical
-- behaviour. Approved payroll cycles are snapshot-frozen in
-- `payroll_item_components` (amounts, not formulas), so changing these values
-- affects ONLY new structures + new cycles.
-- =============================================================================

alter table public.statutory_config
  add column if not exists basic_percent_of_gross  numeric(5,2) not null default 50
    check (basic_percent_of_gross > 0 and basic_percent_of_gross <= 100);

alter table public.statutory_config
  add column if not exists hra_percent_of_basic    numeric(5,2) not null default 50
    check (hra_percent_of_basic >= 0 and hra_percent_of_basic <= 100);

alter table public.statutory_config
  add column if not exists conv_percent_of_basic   numeric(5,2) not null default 10
    check (conv_percent_of_basic >= 0 and conv_percent_of_basic <= 100);

alter table public.statutory_config
  add column if not exists conv_monthly_cap        numeric(14,2) not null default 800
    check (conv_monthly_cap >= 0);

comment on column public.statutory_config.basic_percent_of_gross is
  'BASIC = this % of monthly gross. Default 50. Drives all downstream calcs (PF, HRA, Gratuity).';
comment on column public.statutory_config.hra_percent_of_basic is
  'HRA = this % of BASIC. Default 50.';
comment on column public.statutory_config.conv_percent_of_basic is
  'Conveyance = min(this % of BASIC, conv_monthly_cap). Default 10.';
comment on column public.statutory_config.conv_monthly_cap is
  'Hard monthly cap on Conveyance (₹). Default 800.';
