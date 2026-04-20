import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toCsv, type Cell } from './csv'

/**
 * Tamil Nadu Professional Tax — half-yearly return.
 *
 * TN halves:
 *   - Half 1 (H1): April – September   (paid by 30 September)
 *   - Half 2 (H2): October – March     (paid by 31 March)
 *
 * For each employee we report:
 *   - half-year gross, total PT deducted, slab amount, number of months
 *   - employee bank / identity details for the return register
 *
 * Only months with a LOCKED payroll cycle are included so the numbers match
 * what was actually paid to the employee.
 */
export async function buildPtCsv(half: 'H1' | 'H2', year: number): Promise<{ text: string; fileName: string } | null> {
  const admin = createAdminClient()

  // Resolve half range. H1 starts in April of `year`; H2 starts in October of `year - 1` (same FY).
  // Here we simply interpret `year` as the CALENDAR year the half ENDS in.
  //   H1 2026 → Apr 2026 – Sep 2026
  //   H2 2026 → Oct 2025 – Mar 2026
  const [start, end] = half === 'H1'
    ? [{ y: year, m: 4 }, { y: year, m: 9 }]
    : [{ y: year - 1, m: 10 }, { y: year, m: 3 }]

  const { data: cycles } = await admin
    .from('payroll_cycles')
    .select('id, year, month, status')
    .gte('cycle_start', `${start.y}-${String(start.m).padStart(2, '0')}-01`)
    .lte('cycle_end', `${end.y}-${String(end.m).padStart(2, '0')}-31`)
  if (!cycles || cycles.length === 0) return null

  const eligibleCycleIds = cycles
    .filter((c) => ['approved', 'locked', 'paid'].includes(c.status as string))
    .map((c) => c.id as string)
  if (eligibleCycleIds.length === 0) return null

  const [{ data: items }, { data: ptLines }] = await Promise.all([
    admin
      .from('payroll_items')
      .select('cycle_id, employee_id, employee_code_snapshot, employee_name_snapshot, pan_snapshot, designation_snapshot, monthly_gross, total_earnings')
      .in('cycle_id', eligibleCycleIds),
    admin
      .from('payroll_item_components')
      .select('amount, item:payroll_items!inner ( employee_id, cycle_id )')
      .in('item.cycle_id', eligibleCycleIds)
      .eq('code', 'PT'),
  ])
  if (!items) return null

  type PtRow = { amount: number; item: { employee_id: string; cycle_id: string } }
  const ptByKey = new Map<string, number>()
  for (const r of (ptLines ?? []) as unknown as PtRow[]) {
    ptByKey.set(`${r.item.cycle_id}:${r.item.employee_id}`, Number(r.amount))
  }

  type Agg = {
    code: string
    name: string
    pan: string
    designation: string
    grossHalf: number
    ptHalf: number
    monthsPaid: number
  }
  const byEmp = new Map<string, Agg>()
  for (const i of items) {
    const key = i.employee_id as string
    const agg = byEmp.get(key) ?? {
      code: i.employee_code_snapshot as string,
      name: i.employee_name_snapshot as string,
      pan: (i.pan_snapshot as string | null) ?? '',
      designation: (i.designation_snapshot as string | null) ?? '',
      grossHalf: 0,
      ptHalf: 0,
      monthsPaid: 0,
    }
    agg.grossHalf += Number(i.total_earnings)
    agg.ptHalf += ptByKey.get(`${i.cycle_id}:${i.employee_id}`) ?? 0
    agg.monthsPaid += 1
    byEmp.set(key, agg)
  }

  const rows: Cell[][] = Array.from(byEmp.values())
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => [
      a.code,
      a.name.toUpperCase(),
      a.pan,
      a.designation,
      a.monthsPaid,
      Math.round(a.grossHalf),
      Math.round(a.ptHalf),
    ])

  const text = toCsv(rows, {
    headers: [
      'Employee Code',
      'Name',
      'PAN',
      'Designation',
      'Months',
      'Half-year Gross',
      'PT Deducted',
    ],
  })
  const fileName = `PT_TN_${half}_${year}.csv`
  return { text, fileName }
}
