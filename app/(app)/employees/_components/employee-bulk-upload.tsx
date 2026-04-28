'use client'

import { CsvUpload, type Column } from '@/components/ui/csv-upload'
import { bulkCreateEmployeesAction, type EmployeeBulkRow } from '@/lib/employees/bulk'

const columns: Column<EmployeeBulkRow>[] = [
  { key: 'employee_code',       label: 'Code',         width: '110px', required: true },
  { key: 'work_email',          label: 'Work email',   width: '220px' },
  { key: 'first_name',          label: 'First',        width: '120px', required: true },
  { key: 'middle_name',         label: 'Middle',       width: '110px' },
  { key: 'last_name',           label: 'Last',         width: '120px', required: true },
  { key: 'gender',              label: 'Gender',       width: '90px',  editor: 'select', options: ['M', 'F', 'O'] },
  { key: 'date_of_birth',       label: 'DOB',          width: '140px', editor: 'date' },
  { key: 'date_of_joining',     label: 'DoJ',          width: '140px', editor: 'date', required: true },
  { key: 'employment_type',     label: 'Emp. type',    width: '130px', editor: 'select', options: ['full_time', 'contract', 'intern', 'consultant'] },
  { key: 'employment_status',   label: 'Status',       width: '130px', editor: 'select', options: ['active', 'on_notice', 'resigned', 'terminated', 'exited', 'on_hold'] },
  { key: 'company_code',        label: 'Company',      width: '110px' },
  { key: 'department_code',     label: 'Dept',         width: '100px' },
  { key: 'designation_code',    label: 'Desig',        width: '100px' },
  { key: 'location_code',       label: 'Location',     width: '110px' },
  { key: 'pan_number',          label: 'PAN',          width: '130px' },
  { key: 'aadhaar_number',      label: 'Aadhaar',      width: '140px' },
  { key: 'uan_number',          label: 'UAN',          width: '130px' },
  { key: 'biometric_id',        label: 'Biometric ID', width: '130px' },
  { key: 'personal_email',      label: 'Personal email', width: '200px' },
  { key: 'personal_phone',      label: 'Phone',        width: '130px' },
  { key: 'bank_name',           label: 'Bank',         width: '140px' },
  { key: 'bank_account_number', label: 'A/c #',        width: '160px' },
  { key: 'bank_ifsc',           label: 'IFSC',         width: '130px' },
  { key: 'bank_account_type',   label: 'A/c type',     width: '100px', editor: 'select', options: ['savings', 'current'] },
  { key: 'tax_regime_code',     label: 'Regime',       width: '90px',  editor: 'select', options: ['NEW', 'OLD'] },
  { key: 'lunch_applicable',    label: 'Lunch',        width: '70px',  editor: 'checkbox' },
  { key: 'shift_applicable',    label: 'Shift',        width: '70px',  editor: 'checkbox' },
  { key: 'shift_allowance_monthly', label: 'Shift ₹/mo', width: '110px' },
]

function validate(row: EmployeeBulkRow): string | null {
  if (row.work_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.work_email))) return 'Invalid email'
  if (row.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(row.pan_number).toUpperCase())) return 'PAN format: ABCDE1234F'
  if (row.aadhaar_number && !/^\d{12}$/.test(String(row.aadhaar_number))) return 'Aadhaar must be 12 digits'
  if (row.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(row.bank_ifsc).toUpperCase())) return 'IFSC format: HDFC0ABCDEF'
  if (row.date_of_joining && !/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_joining)) return 'DoJ must be YYYY-MM-DD'
  if (row.date_of_birth && row.date_of_birth !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth)) return 'DOB must be YYYY-MM-DD'
  return null
}

export function EmployeeBulkUpload() {
  return (
    <CsvUpload<EmployeeBulkRow>
      label="Upload employees"
      title="Upload employees from CSV"
      subtitle="Review and edit rows before saving. Unknown company/department/designation codes are flagged."
      templateHref="/api/templates/employees"
      columns={columns}
      validate={validate}
      onSave={(rows) => bulkCreateEmployeesAction(rows)}
    />
  )
}
