'use client'

import { CsvUpload, type Column } from '@/components/ui/csv-upload'
import { bulkCreateLeaveApplicationsAction, type LeaveBulkRow } from '@/lib/leave/bulk'

const columns: Column<LeaveBulkRow>[] = [
  { key: 'employee_code',   label: 'Employee code', width: '140px', required: true },
  { key: 'leave_type_code', label: 'Leave type',    width: '110px', required: true, editor: 'select', options: ['CL', 'SL', 'EL', 'LOP'] },
  { key: 'from_date',       label: 'From',          width: '150px', required: true, editor: 'date' },
  { key: 'to_date',         label: 'To',            width: '150px', required: true, editor: 'date' },
  { key: 'reason',          label: 'Reason',        width: '260px' },
]

function validate(row: LeaveBulkRow): string | null {
  if (row.from_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.from_date)) return 'From date format: YYYY-MM-DD'
  if (row.to_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.to_date)) return 'To date format: YYYY-MM-DD'
  if (row.from_date && row.to_date && row.to_date < row.from_date) return 'To date is before From date'
  return null
}

export function LeaveBulkUpload() {
  return (
    <CsvUpload<LeaveBulkRow>
      label="Upload leave"
      title="Upload leave applications from CSV"
      subtitle="Rows are submitted as 'submitted' — an HR admin still needs to approve them from /leave."
      templateHref="/api/templates/leave"
      columns={columns}
      validate={validate}
      onSave={(rows) => bulkCreateLeaveApplicationsAction(rows)}
    />
  )
}
