import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toEcr, type Cell } from './csv'

/**
 * EPFO ECR 2.0 format — `#~#` delimited, 11 columns per row, no header.
 *
 * Columns:
 *   1. UAN                           (12-digit)
 *   2. Member Name
 *   3. Gross Wages                   (month's gross, rupees)
 *   4. EPF Wages                     (wage base on which EPF is computed, ≤ 15000 per EPFO unless voluntary)
 *   5. EPS Wages                     (EPS wage base; same as EPF wages up to 15000 for members under 58)
 *   6. EDLI Wages                    (capped at 15000)
 *   7. EPF Contribution (Employee)   (12% of EPF wages)
 *   8. EPS Contribution (Employer)   (8.33% of EPS wages, capped at 1250)
 *   9. EPF-EPS Difference (Employer) (employer's EPF share = employer_total_PF − EPS)
 *  10. NCP Days                      (non-contributory period, i.e. LOP days)
 *  11. Refund of Advances            (usually 0)
 */
export async function buildPfEcrText(cycleId: string): Promise<{ text: string; fileName: string } | null> {
  const admin = createAdminClient()

  const [{ data: cycle }, { data: items }] = await Promise.all([
    admin.from('payroll_cycles').select('id, year, month').eq('id', cycleId).maybeSingle(),
    admin
      .from('payroll_items')
      .select(
        `
        employee_id, employee_code_snapshot, employee_name_snapshot,
        monthly_gross, total_earnings, lop_days,
        employee:employees!inner ( uan_number )
      `,
      )
      .eq('cycle_id', cycleId),
  ])
  if (!cycle) return null
  if (!items || items.length === 0) return null

  // Per-item component lookup (BASIC, PF_EE, PF_ER)
  const itemIds = items.map((i) => i.employee_id as string)
  const { data: allComps } = await admin
    .from('payroll_item_components')
    .select('code, amount, item:payroll_items!inner ( employee_id, cycle_id )')
    .eq('item.cycle_id', cycleId)

  type CompRow = { code: string; amount: number; item: { employee_id: string } }
  const byEmp = new Map<string, Map<string, number>>()
  for (const c of (allComps ?? []) as unknown as CompRow[]) {
    const emp = c.item.employee_id
    const m = byEmp.get(emp) ?? new Map<string, number>()
    m.set(c.code, Number(c.amount))
    byEmp.set(emp, m)
  }
  void itemIds // kept for future narrowing

  const rows: Cell[][] = []
  for (const i of items) {
    type EmpEmbed = { uan_number: string | null } | { uan_number: string | null }[] | null
    const emb = i.employee as EmpEmbed
    const uan = (Array.isArray(emb) ? emb[0]?.uan_number : emb?.uan_number) ?? ''

    const comps = byEmp.get(i.employee_id as string) ?? new Map<string, number>()
    const pfEe = comps.get('PF_EE') ?? 0
    const pfEr = comps.get('PF_ER') ?? 0

    // EPF wages derived from contribution / 12% so fixed_max and actual modes are reflected honestly.
    const epfWages = pfEe > 0 ? Math.round(pfEe / 0.12) : 0
    const epsWages = Math.min(epfWages, 15000)
    const edliWages = Math.min(epfWages, 15000)
    const epsContrib = Math.min(Math.round(epsWages * 0.0833), 1250)
    const epfEpsDiff = Math.max(0, pfEr - epsContrib)
    const ncpDays = Math.round(Number(i.lop_days))

    rows.push([
      uan || '',
      (i.employee_name_snapshot as string).toUpperCase(),
      Math.round(Number(i.total_earnings)),   // gross wages
      epfWages,
      epsWages,
      edliWages,
      Math.round(pfEe),
      epsContrib,
      epfEpsDiff,
      ncpDays,
      0, // refund of advances
    ])
  }

  const text = toEcr(rows)
  const monthTag = `${cycle.year}${String(cycle.month as number).padStart(2, '0')}`
  const fileName = `PF_ECR_${monthTag}.txt`
  return { text, fileName }
}
