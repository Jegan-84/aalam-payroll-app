-- =============================================================================
-- Custom pay components — HR-defined formula or fixed org-wide components
-- =============================================================================
-- The `pay_components` table already has `formula` + `calculation_type` columns
-- from Module 1. Statutory components (BASIC, HRA, PF, etc.) are hard-coded in
-- the payroll engine with full tax + statutory logic. Custom components are
-- added ON TOP: HR-defined earnings / deductions evaluated by a tiny formula
-- engine at compute time.
--
-- The `is_custom` flag distinguishes:
--   false (default for seeded rows) — system component, editable only in code
--   true                            — HR-defined, editable via Settings UI
--
-- For per-employee components (SHIFT allowance only for some people) use the
-- existing `employee_pay_components` table. Custom components here apply to
-- every employee uniformly.
-- =============================================================================

alter table public.pay_components
  add column if not exists is_custom boolean not null default false;

alter table public.pay_components
  add column if not exists prorate boolean not null default true;

-- Backfill: every currently seeded code is a system component.
update public.pay_components
  set is_custom = false
  where code in (
    'BASIC','HRA','CONV','OTHERALLOW',
    'PF_EE','ESI_EE','PT','TDS',
    'PF_ER','ESI_ER','GRATUITY','MEDINS',
    'INTERNET','TRAINING',
    'VP'
  );

-- New audit columns for custom rows.
alter table public.pay_components
  add column if not exists created_by uuid references public.users(id) on delete set null;

alter table public.pay_components
  add column if not exists updated_by uuid references public.users(id) on delete set null;

alter table public.pay_components
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.pay_components;
create trigger set_updated_at before update on public.pay_components
  for each row execute function public.tg_set_updated_at();

create index if not exists idx_pay_components_custom_active
  on public.pay_components(display_order)
  where is_custom and is_active;
