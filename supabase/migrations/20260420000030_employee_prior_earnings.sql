-- =============================================================================
-- Form 12B — previous-employer earnings declaration for mid-FY joiners
-- =============================================================================
-- One row per (employee, FY). Captures gross + TDS already paid by the prior
-- employer for this same financial year, so the new employer's TDS engine
-- can compute the combined annual tax under Section 192(2) of the IT Act.
--
-- Regime-agnostic: regardless of which regime the employee chose with the
-- prior employer, this employer always recomputes the combined annual tax
-- under the *current* regime + the *current* declarations, then subtracts the
-- prior TDS already deducted.
-- =============================================================================

create table if not exists public.employee_prior_earnings (
  id                          uuid primary key default gen_random_uuid(),
  employee_id                 uuid not null references public.employees(id) on delete cascade,
  fy_start                    date not null,

  -- Required: gross totals from prior employer for this FY.
  gross_salary                numeric(12, 2) not null default 0,

  -- Optional breakdown — used by Form 16 Part B's "salary from previous
  -- employer" annexure. Not used directly for TDS math.
  basic                       numeric(12, 2),
  hra                         numeric(12, 2),
  conveyance                  numeric(12, 2),
  perquisites                 numeric(12, 2),

  -- Required for TDS math.
  pf_deducted                 numeric(12, 2) not null default 0,
  professional_tax_deducted   numeric(12, 2) not null default 0,
  tds_deducted                numeric(12, 2) not null default 0,

  -- Identifiers — useful for Form 16 cross-reference.
  prev_employer_name          text,
  prev_employer_pan           text,
  prev_employer_tan           text,

  -- Informational. Doesn't bind the new employer's TDS computation.
  prev_regime                 text check (prev_regime in ('OLD', 'NEW') or prev_regime is null),

  -- Workflow.
  declared_at                 timestamptz not null default now(),
  verified_at                 timestamptz,
  verified_by                 uuid references public.users(id),
  notes                       text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  unique (employee_id, fy_start)
);

create index if not exists idx_prior_earnings_fy
  on public.employee_prior_earnings(fy_start);

comment on table public.employee_prior_earnings is
  'Form 12B — prior-employer salary + TDS for this FY. Drives Section 192(2) TDS combination for mid-year joiners.';
