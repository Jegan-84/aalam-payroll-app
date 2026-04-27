import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { Form12BBDocument, type Form12BBData } from '@/lib/pdf/form12bb'
import { resolveFy } from '@/lib/leave/engine'

/**
 * Build a Form 12BB PDF for (employee × FY) from their submitted tax declaration.
 * Returns null if no declaration exists for that FY.
 */
export async function buildForm12BBBuffer(
  employeeId: string,
  fyStart: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const admin = createAdminClient()

  const [{ data: emp }, { data: decl }, { data: org }] = await Promise.all([
    admin
      .from('employees')
      .select(
        `
        employee_code, full_name_snapshot, pan_number,
        department:departments ( name ),
        designation:designations ( name )
      `,
      )
      .eq('id', employeeId)
      .maybeSingle(),
    admin
      .from('employee_tax_declarations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('fy_start', fyStart)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('legal_name, tan, address_line1, address_line2, city, state, pincode')
      .limit(1)
      .maybeSingle(),
  ])
  if (!emp || !decl) return null

  type NameEmbed = { name: string } | { name: string }[] | null
  const firstName = (v: NameEmbed) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null

  // Chapter VI-A breakdown
  const d = decl as Record<string, unknown>
  const chapter: Array<{ section: string; description: string; amount: number }> = []
  const add80c = (label: string, key: string) => {
    const v = Number(d[key] ?? 0)
    if (v > 0) chapter.push({ section: '80C', description: label, amount: v })
  }
  add80c('Public Provident Fund (PPF)', 'sec_80c_ppf')
  add80c('Life Insurance Premium', 'sec_80c_lic')
  add80c('ELSS mutual funds', 'sec_80c_elss')
  add80c('NSC', 'sec_80c_nsc')
  add80c('Tuition fees', 'sec_80c_tuition_fees')
  add80c('Home loan principal repayment', 'sec_80c_home_loan_principal')
  add80c('Employee PF contribution', 'sec_80c_epf')
  add80c('Other 80C', 'sec_80c_other')

  const selfFamily = Number(d.sec_80d_self_family ?? 0)
  if (selfFamily > 0) {
    chapter.push({
      section: '80D',
      description: `Health insurance — self / family${d.sec_80d_self_senior ? ' (senior citizen)' : ''}`,
      amount: selfFamily,
    })
  }
  const parents = Number(d.sec_80d_parents ?? 0)
  if (parents > 0) {
    chapter.push({
      section: '80D',
      description: `Health insurance — parents${d.sec_80d_parents_senior ? ' (senior citizens)' : ''}`,
      amount: parents,
    })
  }

  const nps = Number(d.sec_80ccd_1b_nps ?? 0)
  if (nps > 0) chapter.push({ section: '80CCD(1B)', description: 'NPS additional contribution', amount: nps })

  const edu = Number(d.sec_80e_education_loan ?? 0)
  if (edu > 0) chapter.push({ section: '80E', description: 'Education loan interest', amount: edu })

  const don = Number(d.sec_80g_donations ?? 0)
  if (don > 0) chapter.push({ section: '80G', description: 'Donations', amount: don })

  const tta = Number(d.sec_80tta_savings_interest ?? 0)
  if (tta > 0) chapter.push({ section: '80TTA', description: 'Interest on savings account', amount: tta })

  const fy = resolveFy(new Date(fyStart + 'T00:00:00Z'), 4)

  const orgAddress = org
    ? [org.address_line1, org.address_line2, [org.city, org.state, org.pincode].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : null

  const data: Form12BBData = {
    employee: {
      name: emp.full_name_snapshot as string,
      pan: (emp.pan_number as string | null) ?? null,
      employee_code: emp.employee_code as string,
      designation: firstName(emp.designation as NameEmbed),
      department: firstName(emp.department as NameEmbed),
    },
    employer: {
      name: (org?.legal_name as string | null) ?? 'Company',
      tan: (org?.tan as string | null) ?? null,
      address: orgAddress,
    },
    fy: { start: fy.fyStart, end: fy.fyEnd, label: fy.label },
    regime: (decl.regime as 'NEW' | 'OLD'),
    hra: {
      rent_paid_annual: Number(decl.rent_paid_annual ?? 0),
      metro_city: Boolean(decl.metro_city),
      landlord_name: null,     // not captured yet — future field
      landlord_pan: null,
      landlord_address: null,
    },
    home_loan: {
      interest_paid: Number(decl.home_loan_interest ?? 0),
      lender_name: null,       // not captured yet — future field
      lender_pan: null,
      lender_address: null,
    },
    lta: {
      claimed: Number(decl.lta_claimed ?? 0),
    },
    chapter_vi_a: chapter,
    submitted_at: (decl.submitted_at as string | null) ?? null,
    approved_at: (decl.reviewed_at as string | null) ?? null,
  }

  const buffer = (await renderToBuffer(Form12BBDocument({ data }))) as Buffer
  const safeCode = String(emp.employee_code).replace(/[^A-Za-z0-9_-]/g, '_')
  const fileName = `Form12BB_${safeCode}_FY${fy.label}.pdf`
  return { buffer, fileName }
}
