-- =============================================================================
-- Module 1 Foundation — Extensions, Users, Roles
-- =============================================================================
-- Portability note:
--   We mirror Supabase auth.users into our own `users` table. Business tables
--   FK to `users(id)`, not `auth.users(id)`. To leave Supabase later, point
--   `users.id` to whatever auth provider supplies and drop the trigger below.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- users (mirror of auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id              uuid primary key,                 -- matches auth.users.id
  email           citext not null unique,
  full_name       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Sync new auth.users -> public.users
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Sync email/name updates from auth.users -> public.users
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_updated();

-- -----------------------------------------------------------------------------
-- roles & user_roles (RBAC)
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  id          serial primary key,
  code        text not null unique,        -- e.g. 'admin', 'hr', 'payroll', 'employee'
  name        text not null,
  description text
);

create table if not exists public.user_roles (
  user_id     uuid not null references public.users(id) on delete cascade,
  role_id     int  not null references public.roles(id) on delete restrict,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references public.users(id),
  primary key (user_id, role_id)
);

create index if not exists idx_user_roles_user on public.user_roles(user_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at before update on public.users
  for each row execute function public.tg_set_updated_at();
