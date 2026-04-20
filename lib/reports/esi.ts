import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toCsv, type Cell } from './csv'

/**
 * ESI monthly contribution CSV.
 *
 * Columns follow the ESIC MC Return template (the exact order varies slightly by
 * region; this is the common superset accepted by most bulk-upload tools):
 *
 *   IP Number, IP Name, No. of Days, Total Monthly Wages,
 *   Reason for Zero Contribution, Last Working Day, Employee Contribution,
 *   Employer Contribution
 *
 * Only employees with a non-zero ESI_EE or ESI_ER component line are included
 * (gross ≤ 21000). Others are out-of-coverage and should not appear in the ESI
 * return.
 */
export async function buildEsiCsv(cycleId: string): Promise<{ text: string; fileName: string } | null> {
  const admin = createAdminClient()

  const [{ data: cycle }, { data: items }] = await Promise.all([
    admin.from('payroll_cycles').select('id, year, month').eq('id', cycleId).maybeSingle(),
    admin
      .from('payroll_items')
      .select(
        `
        employee_id, employee_code_snapshot, employee_name_snapshot,
        total_earnings, paid_days,
        employee:employees!inner ( esi_number, date_of_exit )
      `,
      )
      .eq('cycle_id', cycleId),
  ])
  if (!cycle || !items) return null

  const { data: allComps } = await admin
    .from('payroll_item_components')
    .select('code, amount, item:payroll_items!inner ( employee_id, cycle_id )')
    .eq('item.cycle_id', cycleId)
    .in('code', ['ESI_EE', 'ESI_ER'])

  type CompRow = { code: string; amount: number; item: { employee_id: string } }
  const byEmp = new Map<string, { ee: number; er: number }>()
  for (const c of (allComps ?? []) as unknown as CompRow[]) {
    const cur = byEmp.get(c.item.employee_id) ?? { ee: 0, er: 0 }
    if (c.code === 'ESI_EE') cur.ee = Number(c.amount)
    if (c.code === 'ESI_ER') cur.er = Number(c.amount)
    byEmp.set(c.item.employee_id, cur)
  }

  const rows: Cell[][] = []
  for (const i of items) {
    const contrib = byEmp.get(i.employee_id as string) ?? { ee: 0, er: 0 }
    if (contrib.ee === 0 && contrib.er === 0) continue   // out of coverage

    type EmpEmbed = { esi_number: string | null; date_of_exit: string | null } | { esi_number: string | null; date_of_exit: string | null }[] | null
    const emb = i.employee as EmpEmbed
    const esi = (Array.isArray(emb) ? emb[0]?.esi_number : emb?.esi_number) ?? ''
    const exit = (Array.isArray(emb) ? emb[0]?.date_of_exit : emb?.date_of_exit) ?? ''

    rows.push([
      esi || '',
      (i.employee_name_snapshot as string).toUpperCase(),
      Number(i.paid_days).toFixed(0),
      Math.round(Number(i.total_earnings)),
      '',                                    // reason for zero (blank when contribution > 0)
      exit || '',                            // last working day (blank if still active)
      Math.round(contrib.ee),
      Math.round(contrib.er),
    ])
  }

  const text = toCsv(rows, {
    headers: [
      'IP Number',
      'IP Name',
      'No. of Days',
      'Total Monthly Wages',
      'Reason for Zero Contribution',
      'Last Working Day',
      'Employee Contribution',
      'Employer Contribution',
    ],
  })
  const monthTag = `${cycle.year}${String(cycle.month as number).padStart(2, '0')}`
  const fileName = `ESI_${monthTag}.csv`
  return { text, fileName }
}
