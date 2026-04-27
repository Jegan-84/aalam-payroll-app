'use client'

import { CsvUpload, type Column } from '@/components/ui/csv-upload'
import { bulkUploadHolidaysAction, type HolidayBulkRow } from '@/lib/masters/holidays'

export function HolidayBulkUpload({ defaultFy }: { defaultFy?: string }) {
  const columns: Column<HolidayBulkRow>[] = [
    { key: 'financial_year', label: 'FY',      width: '100px', required: true },
    { key: 'holiday_date',   label: 'Date',    width: '140px', required: true, editor: 'date' },
    { key: 'name',           label: 'Name',    width: '220px', required: true },
    { key: 'type',           label: 'Type',    width: '120px', editor: 'select', options: ['public', 'restricted', 'optional'] },
    { key: 'project_code',   label: 'Project', width: '120px' },
    { key: 'location_code',  label: 'Location', width: '120px' },
  ]

  return (
    <CsvUpload<HolidayBulkRow>
      label="Upload CSV"
      title="Upload holidays from CSV"
      subtitle={defaultFy
        ? `Rows are inserted as-is. Leave project / location blank for global. Default FY: ${defaultFy}.`
        : 'Rows are inserted as-is. Leave project / location blank for global.'}
      templateHref="/api/templates/holidays"
      columns={columns}
      validate={(row) => {
        if (row.holiday_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.holiday_date)) {
          return 'Date must be YYYY-MM-DD'
        }
        if (row.type && !['public', 'restricted', 'optional'].includes(row.type.toLowerCase())) {
          return `Unknown type "${row.type}"`
        }
        return null
      }}
      onSave={async (rows) => {
        const res = await bulkUploadHolidaysAction(rows)
        return { created: res.created, skipped: res.skipped }
      }}
    />
  )
}
