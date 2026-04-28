-- =============================================================================
-- Add leave-related entries to activity_types so employees can record leave
-- days on their timesheet (Zoho-style behaviour).
-- =============================================================================
-- These are non-billable by default. Codes mirror leave_types.code where
-- possible so reports can be cross-referenced if needed.
-- =============================================================================

insert into public.activity_types (code, name, is_billable_default, display_order) values
  ('SL',       'Sick Leave',   false, 100),
  ('PL',       'Paid Leave',   false, 110),
  ('EL',       'Earned Leave', false, 120),
  ('COMP_OFF', 'Comp Off',     false, 130),
  ('LOP',      'Loss of Pay',  false, 140),
  ('HOLIDAY',  'Holiday',      false, 150)
on conflict (code) do nothing;
