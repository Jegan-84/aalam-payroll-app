import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { Form12BADocument, type Form12BAData } from '@/lib/pdf/form12ba'
import { resolveFy } from '@/lib/leave/engine'

/**
 * Build a Form 12BA perquisite statement for (employee × FY).
 * Aggregates payroll_item_components where kind = 'perquisite' across all
 * cycles that fall inside the FY, grouped by perquisite name.
 * Returns null if the employee has no perquisite lines in the FY.
 */
export async function buildForm12BABuffer(
  employeeId: string,
  fyStart: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const admin = createAdminClient()

  const fy = resolveFy(new Date(fyStart + 'T00:00:00Z'), 4)
  const fyEnd = fy.fyEnd
  const fyStartIso = fy.fyStart

  const [{ data: emp }, { data: org }, { data: perqRows }] = await Promise.all([
    admin
      .from('employees')
      .select(
        `
        employee_code, full_name_snapshot, pan_number,
        designation:designations ( name )
      `,
      )
      .eq('id', employeeId)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('legal_name, tan, pan, address_line1, address_line2, city, state, pincode')
      .limit(1)
      .maybeSingle(),
    admin
      .from('payroll_item_components')
      .select(
        `
        name, amount, kind,
        item:payroll_items!inner ( employee_id, cycle:payroll_cycles!inner ( year, month, cycle_start ) )
      `,
      )
      .eq('item.employee_id', employeeId)
      .eq('kind', 'perquisite')
      .gte('item.cycle.cycle_start', fyStartIso)
      .lte('item.cycle.cycle_start', fyEnd),
  ])
  if (!emp) return null

  // Aggregate by perquisite name
  type CompRow = { name: string; amount: number; kind: string }
  const byName = new Map<string, number>()
  for (const r of (perqRows ?? []) as unknown as CompRow[]) {
    const k = String(r.name)
    byName.set(k, (byName.get(k) ?? 0) + Number(r.amount))
  }

  if (byName.size === 0) return null

  const perquisites = Array.from(byName.entries()).map(([nature, total], i) => ({
    srNo: i + 1,
    nature,
    valuePerRules: Math.round(total),
    amountRecovered: 0, // V1: perquisites are never recovered from salary
    taxableValue: Math.round(total),
  }))

  type NameEmbed = { name: string } | { name: string }[] | null
  const firstName = (v: NameEmbed) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null

  const orgAddress = org
    ? [org.address_line1, org.address_line2, [org.city, org.state, org.pincode].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : null

  const data: Form12BAData = {
    employee: {
      name: emp.full_name_snapshot as string,
      pan: (emp.pan_number as string | null) ?? null,
      employee_code: emp.employee_code as string,
      designation: firstName(emp.designation as NameEmbed),
    },
    employer: {
      name: (org?.legal_name as string | null) ?? 'Company',
      tan: (org?.tan as string | null) ?? null,
      pan: (org?.pan as string | null) ?? null,
      address: orgAddress,
    },
    fy: { start: fy.fyStart, end: fy.fyEnd, label: fy.label },
    perquisites,
  }

  const buffer = (await renderToBuffer(Form12BADocument({ data }))) as Buffer
  const safeCode = String(emp.employee_code).replace(/[^A-Za-z0-9_-]/g, '_')
  const fileName = `Form12BA_${safeCode}_FY${fy.label}.pdf`
  return { buffer, fileName }
}
