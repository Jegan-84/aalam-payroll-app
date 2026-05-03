# PeopleStack — Supabase / SQL layer

All schema changes live here as **raw SQL migrations** — no Supabase-specific
DSL. The only Supabase-tied file is `migrations/20260419000006_row_level_security.sql`
which references `auth.users`. To move off Supabase, replace that single file.

## Structure

```
supabase/
  migrations/                # Apply in lexical order. Name: YYYYMMDDHHMMSS_description.sql
    20260419000001_extensions_and_users.sql
    20260419000002_organizations_and_masters.sql
    20260419000003_statutory_masters.sql
    20260419000004_leave_and_holidays.sql
    20260419000005_audit_log.sql
    20260419000006_row_level_security.sql
  seed.sql                   # Idempotent master data (PT slabs, tax slabs, pay components, leave types)
```

## Applying migrations

### Option A — Supabase CLI (recommended once the project is linked)

```bash
# One-time: link to your Supabase project
npx supabase link --project-ref <PROJECT-REF>

# Push migrations
npx supabase db push

# Apply seed (safe to re-run — idempotent)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

### Option B — Direct psql (no CLI)

```bash
# Runs every migration in order, then the seed.
for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

`SUPABASE_DB_URL` lives in `.env.local` — the direct Postgres URL from Supabase
project settings > Database > Connection string.

## Rules

- Never edit an applied migration. Write a new one.
- Masters (PT slabs, tax slabs, statutory_config) are effective-dated. Rate
  changes = new row, not UPDATE.
- Business tables FK to `public.users`, never `auth.users`, so the app is
  portable away from Supabase.
- Writes go through server-side code with the service-role key. RLS only
  allows `SELECT` to authenticated users.
