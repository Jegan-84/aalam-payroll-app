import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type MisRow = {
  dimension: string
  employeeCount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
  totalEmployerCost: number
}

export type MisResult = {
  cycle: { id: string; year: number; month: number } | null
  byDepartment: MisRow[]
  byLocation: MisRow[]
  byCompany: MisRow[]
  totals: { employees: number; gross: number; deductions: number; net: number; employerCost: number }
}

/**
 * Management cost MIS for one cycle — rolls payroll_items totals up by
 * department, location, and company (from the snapshot columns on each item).
 */
export async function buildMisReport(cycleId: string): Promise<MisResult> {
  await verifySession()
  const supabase = await createClient()

  const [{ data: cycle }, { data: items }] = await Promise.all([
    supabase.from('payroll_cycles').select('id, year, month').eq('id', cycleId).maybeSingle(),
    supabase
      .from('payroll_items')
      .select('department_snapshot, location_snapshot, company_display_name_snapshot, monthly_gross, total_deductions, net_pay, employer_retirals')
      .eq('cycle_id', cycleId),
  ])

  type Item = {
    department_snapshot: string | null
    location_snapshot: string | null
    company_display_name_snapshot: string | null
    monthly_gross: number
    total_deductions: number
    net_pay: number
    employer_retirals: number
  }
  const rollUp = (items: Item[], key: keyof Item): MisRow[] => {
    const map = new Map<string, MisRow>()
    for (const i of items) {
      const label = (i[key] as string | null) ?? '—'
      const cur = map.get(label) ?? {
        dimension: label,
        employeeCount: 0,
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
        totalEmployerCost: 0,
      }
      cur.employeeCount += 1
      cur.totalGross += Number(i.monthly_gross)
      cur.totalDeductions += Number(i.total_deductions)
      cur.totalNet += Number(i.net_pay)
      cur.totalEmployerCost += Number(i.monthly_gross) + Number(i.employer_retirals)
      map.set(label, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.totalEmployerCost - a.totalEmployerCost)
  }

  const arr = (items ?? []) as unknown as Item[]
  const totals = arr.reduce(
    (t, i) => ({
      employees: t.employees + 1,
      gross: t.gross + Number(i.monthly_gross),
      deductions: t.deductions + Number(i.total_deductions),
      net: t.net + Number(i.net_pay),
      employerCost: t.employerCost + Number(i.monthly_gross) + Number(i.employer_retirals),
    }),
    { employees: 0, gross: 0, deductions: 0, net: 0, employerCost: 0 },
  )

  return {
    cycle: cycle as MisResult['cycle'],
    byDepartment: rollUp(arr, 'department_snapshot'),
    byLocation: rollUp(arr, 'location_snapshot'),
    byCompany: rollUp(arr, 'company_display_name_snapshot'),
    totals,
  }
}
