-- =============================================================================
-- In-app notifications
-- =============================================================================
-- Simple notification inbox. Each notification is scoped to a specific user;
-- the "recipient" abstraction — an HR team-wide notification is produced by
-- inserting one row per HR-role user.
--
-- Categories ('kind') used today:
--   payslip.published      — sent to the employee when their cycle is approved
--   leave.applied          — sent to HR role users
--   leave.reviewed         — sent to the applying employee
--   declaration.submitted  — sent to HR role users
--   declaration.reviewed   — sent to the employee
--   fnf.initiated          — sent to the employee
--   fnf.approved           — sent to the employee
--   loan.sanctioned        — sent to the employee
--
-- Extend the list as more triggers come online; `kind` is just free-text so
-- backfills are trivial.
-- =============================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,

  kind        text not null,
  title       text not null,
  body        text,
  href        text,
  severity    text not null default 'info'
                check (severity in ('info','success','warn','error')),

  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user_recent
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc) where read_at is null;

-- -----------------------------------------------------------------------------
-- RLS — each user reads only their own
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "user_read_own_notifications" on public.notifications;
create policy "user_read_own_notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_update_own_notifications" on public.notifications;
create policy "user_update_own_notifications" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
