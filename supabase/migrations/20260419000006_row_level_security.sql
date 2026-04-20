-- =============================================================================
-- Module 1 Foundation — Row Level Security
-- =============================================================================
-- Supabase requires RLS on any table exposed through its auto-generated REST
-- API. We enable RLS on every table, then allow reads for authenticated users.
-- Mutations go through server-side code using the service-role key, which
-- bypasses RLS — so we can tighten authZ in application code (DAL).
--
-- Portability: kept in a separate migration so a non-Supabase target can skip
-- this file entirely.
-- =============================================================================

alter table public.users                    enable row level security;
alter table public.roles                    enable row level security;
alter table public.user_roles               enable row level security;
alter table public.organizations            enable row level security;
alter table public.departments              enable row level security;
alter table public.designations             enable row level security;
alter table public.locations                enable row level security;
alter table public.pay_components           enable row level security;
alter table public.pt_slabs                 enable row level security;
alter table public.tax_regimes              enable row level security;
alter table public.tax_slabs                enable row level security;
alter table public.tax_config               enable row level security;
alter table public.tax_surcharge_slabs      enable row level security;
alter table public.statutory_config         enable row level security;
alter table public.leave_types              enable row level security;
alter table public.holidays                 enable row level security;
alter table public.audit_log                enable row level security;

-- Authenticated read policies (single-tenant — every signed-in user sees masters).
do $$
declare
  t text;
  tables text[] := array[
    'users','roles','user_roles','organizations','departments','designations',
    'locations','pay_components','pt_slabs','tax_regimes','tax_slabs',
    'tax_config','tax_surcharge_slabs','statutory_config','leave_types',
    'holidays','audit_log'
  ];
begin
  foreach t in array tables loop
    execute format(
      'drop policy if exists "auth_read_%1$s" on public.%1$I;
       create policy "auth_read_%1$s" on public.%1$I
         for select to authenticated using (true);',
      t
    );
  end loop;
end $$;

-- Writes go via service-role only. No INSERT/UPDATE/DELETE policies here —
-- RLS blocks them for anon/authenticated, and service role bypasses RLS.
