-- =============================================================================
-- Storage bucket for employee documents + profile photos
-- =============================================================================
-- Bucket layout:
--   employee-docs/<employee_id>/<filename>
--
-- All file uploads happen via server actions running with the service-role key,
-- so the bucket is private. Reads from the app also go through service-role
-- (we sign URLs in the action). RLS on storage.objects below is a defense-in-
-- depth fallback in case anon/authenticated keys are ever used directly.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-docs',
  'employee-docs',
  false,
  5 * 1024 * 1024,                    -- 5 MB hard cap
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- RLS — only the owning employee (auth.uid linked to employees.user_id) may
-- read; writes are service-role only. Service-role bypasses RLS entirely so
-- these policies don't block server-side uploads.
-- -----------------------------------------------------------------------------
drop policy if exists "employee_docs_owner_read" on storage.objects;
create policy "employee_docs_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'employee-docs'
    and (storage.foldername(name))[1] in (
      select e.id::text from public.employees e where e.user_id = auth.uid()
    )
  );

-- HR/admin/payroll can read everyone's files (used by the admin UI when it
-- streams a doc back through the app).
drop policy if exists "employee_docs_hr_read" on storage.objects;
create policy "employee_docs_hr_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'employee-docs'
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid() and r.code in ('admin','hr','payroll')
    )
  );
