import 'server-only'
import React, { type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createAdminClient } from '@/lib/supabase/admin'
import { Form16Document, type Form16Data } from '@/lib/pdf/form16'
import { computeAnnualTax } from '@/lib/payroll/tax'
import { getTaxSlabsForFy } from '@/lib/payroll/queries'
import { computeDeductions, type RawDeclaration } from '@/lib/tax/declarations'

/**
 * Build a Form 16 Part B PDF for one employee across a full FY.
 *
 * Computation:
 *   - gross, basic, HRA, etc. = SUM of monthly tds_ledger rows in the FY
 *   - taxable income, base tax, surcharge, cess, rebate = recomputed from
 *     actual annual gross (not the mid-year estimates snapshot-ed per month)
 *   - refundable = tdsDeducted − taxPayable
 */
export async function buildForm16Buffer(
  employeeId: string,
  fyStart: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const admin = createAdminClient()

  const [{ data: rows }, { data: org }, { data: employee }] = await Promise.all([
    admin
      .from('tds_ledger')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('fy_start', fyStart)
      .order('year')
      .order('month'),
    admin
      .from('organizations')
      .select('legal_name, display_name, pan, tan, address_line1, address_line2, city, state, pincode')
      .limit(1)
      .maybeSingle(),
    admin
      .from('employees')
      .select(
        `
        employee_code, full_name_snapshot, pan_number, tax_regime_code,
        current_address_line1, current_address_line2, current_address_city, current_address_state, current_address_pincode,
        designation:designations ( name )
      `,
      )
      .eq('id', employeeId)
      .maybeSingle(),
  ])

  if (!rows || rows.length === 0 || !org || !employee) return null

  const regime = (employee.tax_regime_code as 'NEW' | 'OLD' | null) ?? 'NEW'

  // FY-end from the ledger rows
  const fyEnd = rows[0].fy_end as string

  // Aggregate monthly rows
  let grossSalary = 0
  let basic = 0
  let hra = 0
  let conveyance = 0
  let otherAllowances = 0
  let professionalTaxPaid = 0
  let pfEmployee = 0
  let tdsDeducted = 0
  const months = rows.map((r) => {
    grossSalary += Number(r.gross_earnings)
    basic += Number(r.basic_month)
    hra += Number(r.hra_month)
    conveyance += Number(r.conveyance_month)
    otherAllowances += Number(r.other_allowance_month)
    professionalTaxPaid += Number(r.professional_tax_month)
    pfEmployee += Number(r.pf_employee_month)
    tdsDeducted += Number(r.tds_deducted)
    return {
      year: Number(r.year),
      month: Number(r.month),
      grossEarnings: Number(r.gross_earnings),
      tds: Number(r.tds_deducted),
    }
  })

  // Recompute tax on actual FY gross (more accurate than mid-year estimates)
  const taxBundle = await getTaxSlabsForFy(fyStart, regime)
  const stdDeduction = taxBundle.config?.standard_deduction ?? 0

  // For OLD regime, load approved declaration and compute allowed deductions.
  let deductionsBreakup: { label: string; amount: number; cap?: number }[] = []
  let totalDeductions = 0
  if (regime === 'OLD') {
    const { data: decl } = await admin
      .from('employee_tax_declarations')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('fy_start', fyStart)
      .eq('status', 'approved')
      .maybeSingle()
    if (decl) {
      const computed = computeDeductions(decl as unknown as RawDeclaration, {
        hraReceivedAnnual: hra,
        basicAnnual: basic,
      })
      deductionsBreakup = computed.breakup
      totalDeductions = computed.total
    }
  }

  const tax = taxBundle.config
    ? computeAnnualTax({
        annualGross: grossSalary,
        slabs: taxBundle.slabs,
        config: taxBundle.config,
        surchargeSlabs: taxBundle.surchargeSlabs,
        totalDeductions,
        professionalTax: professionalTaxPaid,
      })
    : { taxableIncome: 0, baseTax: 0, rebate: 0, surcharge: 0, cess: 0, total: 0, monthly: 0 }

  const addressParts = [org.address_line1, org.address_line2, [org.city, org.state, org.pincode].filter(Boolean).join(' ')].filter(Boolean) as string[]
  const empAddress = [
    employee.current_address_line1,
    employee.current_address_line2,
    [employee.current_address_city, employee.current_address_state, employee.current_address_pincode].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')

  type DesigEmbed = { name: string } | { name: string }[] | null
  const designation = (() => {
    const d = employee.designation as DesigEmbed
    if (!d) return null
    return Array.isArray(d) ? d[0]?.name ?? null : d.name
  })()

  const fyLabel = `${fyStart.slice(0, 4)}-${fyEnd.slice(2, 4)}`
  const ayStartYear = Number(fyStart.slice(0, 4)) + 1
  const assessmentYear = `${ayStartYear}-${String(ayStartYear + 1).slice(2)}`

  const data: Form16Data = {
    assessmentYear,
    fyLabel,
    periodFrom: fyStart,
    periodTo: fyEnd,
    employer: {
      name: (org.legal_name ?? org.display_name ?? 'Organization') as string,
      address: addressParts.join(', '),
      pan: (org.pan as string | null) ?? null,
      tan: (org.tan as string | null) ?? null,
    },
    employee: {
      name: (employee.full_name_snapshot as string) || (rows[0].employee_name_snapshot as string),
      code: (employee.employee_code as string) || (rows[0].employee_code_snapshot as string),
      pan: (employee.pan_number as string | null) ?? (rows[0].pan_snapshot as string | null),
      designation,
      address: empAddress || null,
    },
    regime,
    totals: {
      grossSalary: Math.round(grossSalary),
      basic: Math.round(basic),
      hra: Math.round(hra),
      conveyance: Math.round(conveyance),
      otherAllowances: Math.round(otherAllowances),
      professionalTaxPaid: Math.round(professionalTaxPaid),
      pfEmployee: Math.round(pfEmployee),
      standardDeduction: stdDeduction,
      taxableIncome: tax.taxableIncome,
      baseTax: tax.baseTax,
      rebate87a: tax.rebate,
      surcharge: tax.surcharge,
      cess: tax.cess,
      taxPayable: tax.total,
      tdsDeducted: Math.round(tdsDeducted),
      taxRefundable: Math.round(tdsDeducted - tax.total),
    },
    months,
    deductionsBreakup,
    totalDeductions: Math.round(totalDeductions),
  }

  const element = React.createElement(Form16Document, { data }) as unknown as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)
  const fileName = `Form16_${data.employee.code}_FY${fyLabel}.pdf`
  return { buffer, fileName }
}
