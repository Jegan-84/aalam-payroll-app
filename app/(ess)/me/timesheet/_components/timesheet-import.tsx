'use client'

import { CsvUpload, type Column } from '@/components/ui/csv-upload'
import {
  importTimesheetEntriesAction,
  type TimesheetImportRow,
} from '@/lib/timesheet/actions'

const columns: Column<TimesheetImportRow>[] = [
  { key: 'entry_date',    label: 'Date',     width: '140px', required: true, editor: 'date' },
  { key: 'project_code',  label: 'Project',  width: '110px', required: true },
  { key: 'activity_code', label: 'Activity', width: '120px', required: true },
  { key: 'task',          label: 'Task',     width: '180px' },
  { key: 'hours',         label: 'Hours',    width: '90px' },
  { key: 'start_time',    label: 'Start',    width: '90px' },
  { key: 'end_time',      label: 'End',      width: '90px' },
  { key: 'work_mode',     label: 'Mode',     width: '90px',  editor: 'select', options: ['WFO', 'WFH'] },
  { key: 'description',   label: 'Notes',    width: '220px' },
]

export function TimesheetImport() {
  return (
    <CsvUpload<TimesheetImportRow>
      label="Import CSV"
      title="Import timesheet entries"
      subtitle="Bulk-create entries for yourself. Either fill 'hours', or fill 'start_time' + 'end_time' (HH:MM, IST) and we'll derive hours. Submitted / approved weeks are skipped."
      templateHref="/api/templates/timesheet"
      columns={columns}
      validate={(row) => {
        if (row.entry_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.entry_date)) return 'Date must be YYYY-MM-DD'
        if (row.start_time && !/^\d{2}:\d{2}$/.test(String(row.start_time))) return 'start_time must be HH:MM'
        if (row.end_time && !/^\d{2}:\d{2}$/.test(String(row.end_time))) return 'end_time must be HH:MM'
        const hasHours = row.hours !== undefined && String(row.hours).trim() !== ''
        const hasRange = !!row.start_time && !!row.end_time
        if (!hasHours && !hasRange) return 'Provide hours, or both start_time and end_time'
        if (row.work_mode && !['WFH', 'WFO'].includes(String(row.work_mode).toUpperCase())) return 'work_mode must be WFH or WFO'
        return null
      }}
      onSave={async (rows) => {
        const res = await importTimesheetEntriesAction(rows)
        return { created: res.created, skipped: res.skipped }
      }}
    />
  )
}
