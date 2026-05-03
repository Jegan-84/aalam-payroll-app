-- =============================================================================
-- Retire raw biometric-punch sync
-- =============================================================================
-- The device-punch ingestion path (ESSL / ZKTeco sync, /attendance/punches UI,
-- lib/attendance/device*.ts) is being replaced by a different biometric flow
-- that doesn't rely on this table. Drop the table + indexes here so the new
-- system can be built without legacy schema getting in the way.
--
-- We KEEP `employees.biometric_id`. The new biometric system will use that
-- column to map employees to their device identifier — same field, new
-- consumer.
--
-- The `attendance_days` table (per-day attendance grid) is unaffected and
-- still drives payroll paid-day computation; only the biometric punch
-- ingestion is being removed.
-- =============================================================================

drop table if exists public.device_punches cascade;
