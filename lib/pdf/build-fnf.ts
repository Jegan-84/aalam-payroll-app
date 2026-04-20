import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { FnfDocument, type FnfPdfData, type FnfPdfLine } from '@/lib/pdf/fnf'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_LOGO_PATH = path.join(process.cwd(), 'public', 'aalamLogo.png')

async function readDefaultLogo(): Promise<Buffer | null> {
  try {
    return await readFile(DEFAULT_LOGO_PATH)
  } catch {
    return null
  }
}

export async function buildFnfBuffer(
  settlementId: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const admin = createAdminClient()

  const [{ data: s }, { data: lineRows }] = await Promise.all([
    admin.from('fnf_settlements').select('*').eq('id', settlementId).maybeSingle(),
    admin.from('fnf_line_items').select('*').eq('settlement_id', settlementId).order('display_order'),
  ])
  if (!s) return null

  const company = {
    name: (s.company_legal_name_snapshot as string | null) ?? 'Company',
    address: (s.company_address_snapshot as string | null) ?? '',
    pan: (s.company_pan_snapshot as string | null) ?? null,
    gstin: (s.company_gstin_snapshot as string | null) ?? null,
    logo_url: (s.company_logo_snapshot as string | null) ?? null,
    logo_buffer: await readDefaultLogo(),
  }

  const lines: FnfPdfLine[] = (lineRows ?? []).map((r) => ({
    code: r.code as string,
    name: r.name as string,
    kind: r.kind as 'earning' | 'deduction',
    amount: Number(r.amount),
    source: r.source as 'auto' | 'manual',
  }))

  const data: FnfPdfData = {
    company,
    employee: {
      code: s.employee_code_snapshot as string,
      name: s.employee_name_snapshot as string,
      pan: (s.pan_snapshot as string | null) ?? null,
      department: (s.department_snapshot as string | null) ?? null,
      designation: (s.designation_snapshot as string | null) ?? null,
      date_of_joining: s.date_of_joining_snapshot as string,
      last_working_day: s.last_working_day as string,
      bank_name: (s.bank_name_snapshot as string | null) ?? null,
      bank_account: (s.bank_account_snapshot as string | null) ?? null,
      bank_ifsc: (s.bank_ifsc_snapshot as string | null) ?? null,
      tax_regime: (s.tax_regime_snapshot as string | null) ?? 'NEW',
    },
    tenure: {
      service_days: Number(s.service_days),
      service_years: Number(s.service_years),
      gratuity_eligible: Boolean(s.gratuity_eligible),
      notice_period_days: Number(s.notice_period_days),
      notice_days_served: Number(s.notice_days_served),
    },
    totals: {
      leave_encashment_days: Number(s.leave_encashment_days),
      leave_encashment_amount: Number(s.leave_encashment_amount),
      gratuity_amount: Number(s.gratuity_amount),
      final_tds: Number(s.final_tds),
      total_earnings: Number(s.total_earnings),
      total_deductions: Number(s.total_deductions),
      net_payout: Number(s.net_payout),
      fy_gross_before_fnf: Number(s.fy_gross_before_fnf),
      fy_tds_before_fnf: Number(s.fy_tds_before_fnf),
    },
    lines,
    status: s.status as FnfPdfData['status'],
  }

  const buffer = (await renderToBuffer(FnfDocument({ data }))) as Buffer
  const safeCode = String(s.employee_code_snapshot).replace(/[^A-Za-z0-9_-]/g, '_')
  const fileName = `FNF_${safeCode}_${s.last_working_day}.pdf`
  return { buffer, fileName }
}
