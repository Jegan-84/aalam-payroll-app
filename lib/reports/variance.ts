import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/auth/dal'

export type VarianceRow = {
  code: string
  name: string
  kind: string
  currentTotal: number
  previousTotal: number
  deltaAmount: number
  deltaPercent: number | null
}

export type VarianceResult = {
  cycleA: { id: string; year: number; month: number } | null
  cycleB: { id: string; year: number; month: number } | null
  rows: VarianceRow[]
  totals: {
    currentTotal: number
    previousTotal: number
    delta: number
  }
}

/** Compare component totals between two payroll cycles. */
export async function buildVarianceReport(
  currentCycleId: string,
  previousCycleId: string,
): Promise<VarianceResult> {
  await verifySession()
  const supabase = await createClient()

  const [{ data: cycleA }, { data: cycleB }] = await Promise.all([
    supabase.from('payroll_cycles').select('id, year, month').eq('id', currentCycleId).maybeSingle(),
    supabase.from('payroll_cycles').select('id, year, month').eq('id', previousCycleId).maybeSingle(),
  ])

  const sumsByCycle = async (cycleId: string) => {
    const { data } = await supabase
      .from('payroll_item_components')
      .select('code, name, kind, amount, item:payroll_items!inner ( cycle_id )')
      .eq('item.cycle_id', cycleId)
    const byCode = new Map<string, { code: string; name: string; kind: string; amount: number }>()
    for (const c of (data ?? []) as unknown as Array<{ code: string; name: string; kind: string; amount: number }>) {
      const cur = byCode.get(c.code) ?? { code: c.code, name: c.name, kind: c.kind, amount: 0 }
      cur.amount += Number(c.amount)
      byCode.set(c.code, cur)
    }
    return byCode
  }

  const [mapA, mapB] = await Promise.all([sumsByCycle(currentCycleId), sumsByCycle(previousCycleId)])

  const codes = new Set<string>([...mapA.keys(), ...mapB.keys()])
  const rows: VarianceRow[] = []
  let currentTotalAll = 0
  let previousTotalAll = 0
  for (const code of codes) {
    const a = mapA.get(code)
    const b = mapB.get(code)
    const cur = Math.round(a?.amount ?? 0)
    const prev = Math.round(b?.amount ?? 0)
    const delta = cur - prev
    const deltaPct = prev === 0 ? (cur === 0 ? 0 : null) : (delta / prev) * 100
    currentTotalAll += cur
    previousTotalAll += prev
    rows.push({
      code,
      name: a?.name ?? b?.name ?? code,
      kind: a?.kind ?? b?.kind ?? '',
      currentTotal: cur,
      previousTotal: prev,
      deltaAmount: delta,
      deltaPercent: deltaPct,
    })
  }
  rows.sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount))

  return {
    cycleA: cycleA as VarianceResult['cycleA'],
    cycleB: cycleB as VarianceResult['cycleB'],
    rows,
    totals: { currentTotal: currentTotalAll, previousTotal: previousTotalAll, delta: currentTotalAll - previousTotalAll },
  }
}
