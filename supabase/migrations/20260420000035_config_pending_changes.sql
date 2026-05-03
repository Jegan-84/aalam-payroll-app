-- =============================================================================
-- Two-level approval for sensitive configuration changes
-- =============================================================================
-- Statutory config / tax slabs / tax config / tax surcharge / PT slabs are
-- payroll-critical. A single mistake can mis-cut TDS for the whole org. We
-- gate them through a pending-changes table:
--
--   1. Maker (HR / payroll) submits a proposed change. Nothing is written to
--      the live target table — only a `config_pending_changes` row.
--   2. Checker (admin) reviews + approves. Only THEN does the proposed
--      payload get applied to the target table.
--
-- The dispatcher in lib/config-approvals reads `target_table` + `action` and
-- routes to the right applier function. New configuration types just need a
-- new applier; the table + UI stay the same.
-- =============================================================================

create table if not exists public.config_pending_changes (
  id              uuid primary key default gen_random_uuid(),
  -- Which configuration is being changed.
  target_table    text not null
                    check (target_table in (
                      'statutory_config',
                      'tax_slabs',
                      'tax_config',
                      'tax_surcharge_slabs',
                      'tax_clone_fy',
                      'pt_slabs'
                    )),
  -- What kind of change (free text the dispatcher understands per-target).
  action          text not null,
  -- Optional pointer to the target row when relevant (statutory_config.id,
  -- pt_slabs (state, effective_from), etc.). Free-form because the row PK is
  -- not always a uuid (pt_slabs is composite-keyed).
  target_id       text,
  -- The proposed values, as JSON. Shape is dictated by the applier.
  payload         jsonb not null,
  -- Human-readable summary so the approval queue is scannable.
  description     text,

  status          text not null default 'submitted'
                    check (status in ('submitted', 'approved', 'rejected')),

  submitted_by    uuid references public.users(id) on delete set null,
  submitted_at    timestamptz not null default now(),

  decided_by      uuid references public.users(id) on delete set null,
  decided_at      timestamptz,
  decision_note   text,

  created_at      timestamptz not null default now()
);

create index if not exists idx_config_pending_status
  on public.config_pending_changes (status, submitted_at desc);

create index if not exists idx_config_pending_target
  on public.config_pending_changes (target_table, status);

alter table public.config_pending_changes enable row level security;

drop policy if exists "auth_read_config_pending_changes" on public.config_pending_changes;
create policy "auth_read_config_pending_changes" on public.config_pending_changes
  for select to authenticated using (true);

comment on table public.config_pending_changes is
  'Two-level approval queue for sensitive payroll configuration changes (statutory, tax, PT). Maker submits; admin approves; the dispatcher applies the payload to the target table on approval.';
