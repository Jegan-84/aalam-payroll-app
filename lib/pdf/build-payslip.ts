import 'server-only'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React, { type ReactElement } from 'react'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { PayslipDocument, type PayslipComponent, type PayslipData } from '@/lib/pdf/payslip'
import { createAdminClient } from '@/lib/supabase/admin'
import { MONTH_NAMES } from '@/lib/attendance/engine'

const DEFAULT_LOGO_PATH = path.join(process.cwd(), 'public', 'aalamLogo.png')

async function readDefaultLogo(): Promise<Buffer | null> {
  try {
    return await readFile(DEFAULT_LOGO_PATH)
  } catch {
    return null
  }
}

/**
 * Fetch a single payroll item + cycle + org, render a payslip PDF, return the Buffer.
 * Returns null if the item doesn't exist.
 */
export async function buildPayslipBuffer(
  cycleId: string,
  employeeId: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const admin = createAdminClient()

  const [{ data: item }, { data: cycle }, { data: components }, { data: org }, { data: employee }] = await Promise.all([
    admin
      .from('payroll_items')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('employee_id', employeeId)
      .maybeSingle(),
    admin.from('payroll_cycles').select('id, year, month').eq('id', cycleId).maybeSingle(),
    admin
      .from('payroll_item_components')
      .select('code, name, kind, amount, display_order, item:payroll_items!inner ( cycle_id, employee_id )')
      .eq('item.cycle_id', cycleId)
      .eq('item.employee_id', employeeId),
    admin
      .from('organizations')
      .select('display_name, legal_name, address_line1, address_line2, city, state, pincode, pan, gstin, logo_url')
      .limit(1)
      .maybeSingle(),
    admin
      .from('employees')
      .select('date_of_joining, uan_number, esi_number')
      .eq('id', employeeId)
      .maybeSingle(),
  ])

  if (!item || !cycle) return null

  // Resolve company source: the payroll item's snapshot takes precedence, then a
  // live fetch of the employee's current company, then the org singleton as last resort.
  type CompanySource = {
    name: string
    address: string
    pan: string | null
    gstin: string | null
    logo_url: string | null
  }
  let company: CompanySource | null = null
  if (item.company_id && item.company_legal_name_snapshot) {
    company = {
      name: String(item.company_legal_name_snapshot),
      address: String(item.company_address_snapshot ?? ''),
      pan: (item.company_pan_snapshot as string | null) ?? null,
      gstin: (item.company_gstin_snapshot as string | null) ?? null,
      logo_url: (item.company_logo_snapshot as string | null) ?? null,
    }
  } else {
    // Live fetch from the employee's current company (migrations may have just added column; old items have no snapshot).
    const { data: liveCompany } = await admin
      .from('employees')
      .select('company:companies ( legal_name, pan, gstin, logo_url, address_line1, address_line2, city, state, pincode )')
      .eq('id', employeeId)
      .maybeSingle()
    type Co = { legal_name: string; pan: string | null; gstin: string | null; logo_url: string | null; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; pincode: string | null } | null
    const co = (liveCompany ? (Array.isArray(liveCompany.company) ? liveCompany.company[0] : liveCompany.company) : null) as Co
    if (co) {
      const addrParts = [co.address_line1, co.address_line2, [co.city, co.state, co.pincode].filter(Boolean).join(' ')].filter(Boolean) as string[]
      company = {
        name: co.legal_name,
        address: addrParts.join(', '),
        pan: co.pan,
        gstin: co.gstin,
        logo_url: co.logo_url,
      }
    }
  }

  // Fallback to the organizations singleton (for pre-company-migration data)
  if (!company) {
    const addressParts = [
      org?.address_line1,
      org?.address_line2,
      [org?.city, org?.state, org?.pincode].filter(Boolean).join(' '),
    ].filter(Boolean) as string[]
    company = {
      name: (org?.legal_name ?? org?.display_name ?? 'Organization') as string,
      address: addressParts.join(', '),
      gstin: (org?.gstin as string | null) ?? null,
      pan: (org?.pan as string | null) ?? null,
      logo_url: (org?.logo_url as string | null) ?? null,
    }
  }

  // If the resolved company has no explicit logo URL, fall back to the bundled Aalam logo.
  let logoBuffer: Buffer | null = null
  if (!company.logo_url) {
    logoBuffer = await readDefaultLogo()
  }

  const data: PayslipData = {
    org: {
      name: company.name,
      address: company.address,
      gstin: company.gstin,
      pan: company.pan,
      logo_url: company.logo_url,
      logo_buffer: logoBuffer,
    },
    cycle: { year: cycle.year as number, month: cycle.month as number },
    item: {
      employee_code: item.employee_code_snapshot as string,
      employee_name: item.employee_name_snapshot as string,
      pan: (item.pan_snapshot as string | null) ?? null,
      department: (item.department_snapshot as string | null) ?? null,
      designation: (item.designation_snapshot as string | null) ?? null,
      location: (item.location_snapshot as string | null) ?? null,
      bank_name: (item.bank_name_snapshot as string | null) ?? null,
      bank_account: (item.bank_account_snapshot as string | null) ?? null,
      bank_ifsc: (item.bank_ifsc_snapshot as string | null) ?? null,
      tax_regime: (item.tax_regime_snapshot as string | null) ?? null,
      days_in_month: Number(item.days_in_month),
      paid_days: Number(item.paid_days),
      lop_days: Number(item.lop_days),
      leave_days: Number(item.leave_days),
      proration_factor: Number(item.proration_factor),
      total_earnings: Number(item.total_earnings),
      total_deductions: Number(item.total_deductions),
      net_pay: Number(item.net_pay),
      employer_retirals: Number(item.employer_retirals),
      monthly_tds: Number(item.monthly_tds),
      date_of_joining: (employee?.date_of_joining as string | null) ?? null,
      uan_number: (employee?.uan_number as string | null) ?? null,
      esi_number: (employee?.esi_number as string | null) ?? null,
    },
    components: (components ?? []).map((c) => ({
      code: c.code as string,
      name: c.name as string,
      kind: c.kind as PayslipComponent['kind'],
      amount: Number(c.amount),
      display_order: Number(c.display_order),
    })),
  }

  const element = React.createElement(PayslipDocument, { data }) as unknown as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)
  const fileName = `Payslip_${data.item.employee_code}_${MONTH_NAMES[cycle.month - 1]}_${cycle.year}.pdf`
  return { buffer, fileName }
}
