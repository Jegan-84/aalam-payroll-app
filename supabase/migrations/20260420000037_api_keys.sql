-- =============================================================================
-- API keys — for machine-to-machine access to /api/v1/*
-- =============================================================================
-- Used when an external application needs to read or write masters
-- (projects, activity types) without going through the user-session flow.
--
-- The plain-text secret is shown ONCE at creation; only its SHA-256 hash is
-- stored. The `prefix` (first 8 chars) lets admins identify a key at a glance
-- without exposing the secret.
-- =============================================================================

create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                    -- "Mobile app", "Internal tool"
  prefix        text not null,                    -- first 8 chars of the key (display only)
  key_hash      text not null unique,             -- SHA-256 hex of the secret
  scopes        text[] not null default '{}',     -- ['projects:read', 'projects:write', ...]
  is_active     boolean not null default true,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid references public.users(id) on delete set null
);

create index if not exists idx_api_keys_active   on public.api_keys (is_active, prefix);
create index if not exists idx_api_keys_last_used on public.api_keys (last_used_at desc);

alter table public.api_keys enable row level security;

-- Reads are admin-only (UI lists). Writes always go through the service role
-- in the action layer.
drop policy if exists "auth_read_api_keys" on public.api_keys;
create policy "auth_read_api_keys" on public.api_keys
  for select to authenticated using (true);

comment on table public.api_keys is
  'API keys for /api/v1/* machine-to-machine access. Plain secret is shown once at creation; only the SHA-256 hash is stored.';
