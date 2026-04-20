-- =============================================================================
-- Module 1 Foundation — Audit log
-- =============================================================================
-- Generic event log. Every destructive or sensitive action in the app should
-- write here from the server action / route handler layer.
-- =============================================================================

create table if not exists public.audit_log (
  id              bigserial primary key,
  occurred_at     timestamptz not null default now(),
  actor_user_id   uuid references public.users(id) on delete set null,
  actor_email     citext,                       -- snapshotted in case user deleted
  action          text not null,                -- e.g. 'payroll.run.freeze'
  entity_type     text,                         -- e.g. 'payroll_run'
  entity_id       text,                         -- stringified (supports int/uuid)
  summary         text,
  before_state    jsonb,
  after_state     jsonb,
  ip_address      inet,
  user_agent      text
);

create index if not exists idx_audit_occurred   on public.audit_log(occurred_at desc);
create index if not exists idx_audit_actor      on public.audit_log(actor_user_id);
create index if not exists idx_audit_entity     on public.audit_log(entity_type, entity_id);
