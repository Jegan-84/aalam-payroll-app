-- =============================================================================
-- Proof of Investment (POI) documents — OLD regime tax proofs
-- =============================================================================
-- Employees on the OLD regime upload supporting evidence for each Chapter VI-A
-- and HRA/home-loan claim: rent receipts, LIC premium receipts, 80C certificates,
-- health insurance invoices, home-loan interest statements, etc.
--
-- HR reviews each document and marks it approved / rejected with an optional
-- note. Downstream: the declaration's final approval should ideally require all
-- attached POIs to be approved (enforced in the review UI, not the schema).
--
-- File bytes live in Supabase Storage bucket `poi-documents`; this table stores
-- the metadata + the storage key.
-- =============================================================================

create table if not exists public.poi_documents (
  id                uuid primary key default gen_random_uuid(),

  -- declaration_id is nullable because employees may upload proofs ahead of
  -- saving a declaration draft. The action layer stitches them together by
  -- (employee_id, fy_start) when the draft appears.
  declaration_id    uuid references public.employee_tax_declarations(id) on delete set null,
  employee_id       uuid not null references public.employees(id) on delete cascade,
  fy_start          date not null,

  section           text not null
                      check (section in ('80C','80D','80CCD1B','80E','80G','80TTA','HRA','24B','LTA','OTHER')),
  sub_category      text,                          -- free text: 'PPF', 'LIC', 'Rent receipts Apr-Jun', etc.
  claimed_amount    numeric(14,2) not null default 0 check (claimed_amount >= 0),

  file_path         text not null,                  -- Storage path inside the bucket
  file_name         text not null,
  file_size_bytes   int,
  mime_type         text,

  status            text not null default 'pending'
                      check (status in ('pending','approved','rejected')),
  review_notes      text,

  uploaded_at       timestamptz not null default now(),
  uploaded_by       uuid references public.users(id) on delete set null,
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.users(id) on delete set null,

  updated_at        timestamptz not null default now()
);

create index if not exists idx_poi_emp_fy       on public.poi_documents(employee_id, fy_start);
create index if not exists idx_poi_status       on public.poi_documents(status);
create index if not exists idx_poi_declaration  on public.poi_documents(declaration_id);
create index if not exists idx_poi_queue        on public.poi_documents(status, uploaded_at desc) where status = 'pending';

drop trigger if exists set_updated_at on public.poi_documents;
create trigger set_updated_at before update on public.poi_documents
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — each employee can read their own; admins read all (service role bypasses).
-- -----------------------------------------------------------------------------
alter table public.poi_documents enable row level security;

drop policy if exists "auth_read_poi_documents" on public.poi_documents;
create policy "auth_read_poi_documents" on public.poi_documents
  for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- Storage bucket — `poi-documents`, private. All reads/writes go through the
-- admin client in server actions (service role bypasses the policies below);
-- the policies exist defensively to block direct anon-key access.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('poi-documents', 'poi-documents', false)
  on conflict (id) do nothing;

drop policy if exists "poi_no_anon_access" on storage.objects;
create policy "poi_no_anon_access" on storage.objects
  for all to anon
  using (bucket_id <> 'poi-documents')
  with check (bucket_id <> 'poi-documents');
