import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toCsv, type Cell } from './csv'

/**
 * Gratuity register (snapshot as-of a given date, default: today).
 *
 * Per the Payment of Gratuity Act:
 *   gratuity = (last_drawn_basic × 15 / 26) × completed_years_of_service
 * The employee is eligible on completing 5 continuous years of service
 * (treat ≥ 4.67 years as eligible — the Madras HC interpretation,
 * rounding 240 days in the 5th year).
 *
 * Our register reports:
 *   - the employee's DoJ and years-of-service as of asOf
 *   - their current monthly Basic (from the active salary structure)
 *   - statutory gratuity payable if exited today
 *   - the monthly accrual the company books (4.81% of Basic) — matches CTC
 */
export async function buildGratuityCsv(asOfIso?: string): Promise<{ text: string; fileName: string }> {
  const admin = createAdminClient()
  const asOf = asOfIso ?? new Date().toISOString().slice(0, 10)

  const { data: employees } = await admin
    .from('employees')
    .select(
      `
      id, employee_code, full_name_snapshot, date_of_joining, date_of_exit, employment_status,
      current_structure:salary_structures!left (
        id, annual_fixed_ctc, annual_gross, monthly_gross, effective_from, effective_to, status
      )
    `,
    )
    .in('employment_status', ['active', 'on_notice', 'resigned'])
    .order('date_of_joining')

  const asOfDate = new Date(asOf + 'T00:00:00Z')

  type StructEmbed = { id: string; monthly_gross: number; effective_to: string | null; status: string }
  const rows: Cell[][] = []

  for (const e of employees ?? []) {
    const structs = (Array.isArray(e.current_structure) ? e.current_structure : [e.current_structure]) as StructEmbed[]
    const active = structs.find((s) => s && s.effective_to === null && s.status === 'active')

    const monthlyGross = active ? Number(active.monthly_gross) : 0
    const basic = monthlyGross * 0.5

    const dojStr = e.date_of_joining as string
    const doj = new Date(dojStr + 'T00:00:00Z')
    const years = (asOfDate.getTime() - doj.getTime()) / (365.2425 * 24 * 60 * 60 * 1000)
    const eligible = years >= 4.67

    const statutory = eligible ? Math.round((basic * 15) / 26 * years) : 0
    const monthlyAccrual = Math.round(basic * 0.0481)

    rows.push([
      e.employee_code as string,
      (e.full_name_snapshot as string).toUpperCase(),
      dojStr,
      (e.date_of_exit as string | null) ?? '',
      years.toFixed(2),
      eligible ? 'Yes' : 'No',
      Math.round(basic),
      monthlyAccrual,
      statutory,
    ])
  }

  const text = toCsv(rows, {
    headers: [
      'Employee Code',
      'Name',
      'Date of Joining',
      'Date of Exit',
      'Years of Service',
      'Eligible (≥ 4.67 yrs)',
      'Last Drawn Basic / mo',
      'Monthly Accrual (4.81%)',
      'Statutory Gratuity (if exited today)',
    ],
  })
  const fileName = `Gratuity_Register_${asOf}.csv`
  return { text, fileName }
}
