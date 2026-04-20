import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { rupeesInWords } from '@/lib/pdf/number-to-words'

export type Form16Data = {
  assessmentYear: string           // e.g. "2027-28"
  fyLabel: string                  // "2026-27"
  periodFrom: string               // ISO within FY
  periodTo: string                 // ISO within FY

  employer: {
    name: string
    address: string
    pan: string | null
    tan: string | null
  }
  employee: {
    name: string
    code: string
    pan: string | null
    designation: string | null
    address: string | null
  }

  regime: 'NEW' | 'OLD'

  totals: {
    grossSalary: number           // sum of monthly earnings
    basic: number
    hra: number
    conveyance: number
    otherAllowances: number
    professionalTaxPaid: number
    pfEmployee: number            // info
    standardDeduction: number
    taxableIncome: number
    baseTax: number
    rebate87a: number
    surcharge: number
    cess: number
    taxPayable: number
    tdsDeducted: number
    taxRefundable: number         // negative means payable
  }

  months: {
    year: number
    month: number
    grossEarnings: number
    tds: number
  }[]

  /** OLD-regime exemption / Chapter VI-A breakdown. Empty for NEW regime. */
  deductionsBreakup?: { label: string; amount: number; cap?: number }[]
  totalDeductions?: number
}

const colors = {
  brand: '#111827',
  muted: '#6B7280',
  border: '#D1D5DB',
  bg: '#F9FAFB',
  accent: '#1F2937',
}

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 26, paddingHorizontal: 28, fontSize: 9, fontFamily: 'Helvetica', color: '#111827', lineHeight: 1.35 },
  title: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', color: colors.brand },
  subtitle: { fontSize: 9.5, textAlign: 'center', marginTop: 2, color: colors.muted },
  headerRule: { borderBottomWidth: 1, borderBottomColor: colors.border, marginVertical: 8 },

  section: { marginTop: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: colors.brand, marginBottom: 4 },

  grid2: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
  label: { fontSize: 7.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 10, color: colors.accent, marginBottom: 4 },

  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 2 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  trLast: { flexDirection: 'row' },
  trHead: { flexDirection: 'row', backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  trTotal: { flexDirection: 'row', backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },

  colSr: { width: 20, padding: 4, fontSize: 8.5 },
  colDesc: { flex: 1, padding: 4, fontSize: 9.5 },
  colDescBold: { flex: 1, padding: 4, fontSize: 9.5, fontWeight: 'bold' },
  colAmt: { width: 90, padding: 4, fontSize: 9.5, textAlign: 'right' },
  colAmtBold: { width: 90, padding: 4, fontSize: 9.5, textAlign: 'right', fontWeight: 'bold' },
  colAmtSub: { width: 90, padding: 4, fontSize: 9.5, textAlign: 'right', color: colors.muted },

  footnote: { marginTop: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, fontSize: 8, color: colors.muted },
})

const inr = (n: number): string =>
  (n < 0 ? '-' : '') + '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)))

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function Row({ sr, desc, amount, bold, sub }: { sr: string; desc: string; amount?: number; bold?: boolean; sub?: boolean }) {
  return (
    <View style={styles.tr}>
      <Text style={styles.colSr}>{sr}</Text>
      <Text style={bold ? styles.colDescBold : styles.colDesc}>{desc}</Text>
      <Text style={bold ? styles.colAmtBold : sub ? styles.colAmtSub : styles.colAmt}>
        {amount != null ? inr(amount) : ''}
      </Text>
    </View>
  )
}

export function Form16Document({ data }: { data: Form16Data }) {
  const { employer, employee, totals, months, regime, fyLabel, assessmentYear, periodFrom, periodTo } = data

  return (
    <Document title={`Form 16 Part B — ${employee.code} — FY ${fyLabel}`} author={employer.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM 16 — PART B</Text>
        <Text style={styles.subtitle}>
          Details of salary paid and tax deducted at source · FY {fyLabel} · AY {assessmentYear}
        </Text>
        <Text style={styles.subtitle}>
          Period of employment in FY: {periodFrom} to {periodTo} · Regime: {regime}
        </Text>

        <View style={styles.headerRule} />

        <View style={styles.grid2}>
          <View style={styles.cell}>
            <Text style={styles.sectionTitle}>Employer</Text>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{employer.name}</Text>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{employer.address || '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>PAN</Text>
                <Text style={styles.value}>{employer.pan ?? '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>TAN</Text>
                <Text style={styles.value}>{employer.tan ?? '—'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.cell}>
            <Text style={styles.sectionTitle}>Employee</Text>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{employee.name}</Text>
            <Text style={styles.label}>Employee code · Designation</Text>
            <Text style={styles.value}>{employee.code} · {employee.designation ?? '—'}</Text>
            <Text style={styles.label}>PAN</Text>
            <Text style={styles.value}>{employee.pan ?? '—'}</Text>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{employee.address ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Gross Salary</Text>
          <View style={styles.table}>
            <Row sr="1(a)" desc="Salary u/s 17(1) — Basic" amount={totals.basic} />
            <Row sr="1(b)" desc="Salary u/s 17(1) — HRA" amount={totals.hra} />
            <Row sr="1(c)" desc="Salary u/s 17(1) — Conveyance" amount={totals.conveyance} />
            <Row sr="1(d)" desc="Salary u/s 17(1) — Other allowances" amount={totals.otherAllowances} />
            <View style={styles.trTotal}>
              <Text style={styles.colSr}>1</Text>
              <Text style={styles.colDescBold}>Total Gross Salary</Text>
              <Text style={styles.colAmtBold}>{inr(totals.grossSalary)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Less: Allowances exempt u/s 10 &amp; Chapter VI-A</Text>
          <View style={styles.table}>
            {regime === 'NEW' && (
              <Row sr="2" desc="Not applicable under New Regime" amount={0} sub />
            )}
            {regime === 'OLD' && (!data.deductionsBreakup || data.deductionsBreakup.length === 0) && (
              <Row sr="2" desc="No approved tax declaration on file" amount={0} sub />
            )}
            {regime === 'OLD' && data.deductionsBreakup && data.deductionsBreakup.length > 0 && (
              <>
                {data.deductionsBreakup.filter((b) => b.amount > 0).map((b, i) => (
                  <Row key={b.label + i} sr={`2.${i + 1}`} desc={b.label + (b.cap ? ` (cap ${inr(b.cap)})` : '')} amount={-b.amount} />
                ))}
                <View style={styles.trTotal}>
                  <Text style={styles.colSr}>2</Text>
                  <Text style={styles.colDescBold}>Total exemptions &amp; deductions</Text>
                  <Text style={styles.colAmtBold}>{inr(-(data.totalDeductions ?? 0))}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Deductions u/s 16</Text>
          <View style={styles.table}>
            <Row sr="3(a)" desc="Standard deduction u/s 16(ia)" amount={totals.standardDeduction} />
            <Row sr="3(b)" desc="Professional Tax u/s 16(iii)" amount={totals.professionalTaxPaid} />
            <View style={styles.trTotal}>
              <Text style={styles.colSr}>3</Text>
              <Text style={styles.colDescBold}>Total deductions under section 16</Text>
              <Text style={styles.colAmtBold}>{inr(totals.standardDeduction + totals.professionalTaxPaid)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Income chargeable under &quot;Salaries&quot;</Text>
          <View style={styles.table}>
            <View style={styles.trTotal}>
              <Text style={styles.colSr}>4</Text>
              <Text style={styles.colDescBold}>Gross − deductions (4 = 1 − 3)</Text>
              <Text style={styles.colAmtBold}>{inr(totals.grossSalary - totals.standardDeduction - totals.professionalTaxPaid)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Tax computation</Text>
          <View style={styles.table}>
            <Row sr="5(a)" desc="Taxable income (after standard deduction)" amount={totals.taxableIncome} />
            <Row sr="5(b)" desc="Tax on taxable income (per slabs)" amount={totals.baseTax} />
            <Row sr="5(c)" desc="Less: Rebate u/s 87A" amount={-totals.rebate87a} />
            <Row sr="5(d)" desc="Surcharge" amount={totals.surcharge} />
            <Row sr="5(e)" desc="Health & Education Cess (4%)" amount={totals.cess} />
            <View style={styles.trTotal}>
              <Text style={styles.colSr}>5</Text>
              <Text style={styles.colDescBold}>Total Tax Payable</Text>
              <Text style={styles.colAmtBold}>{inr(totals.taxPayable)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Tax deducted at source (month-wise)</Text>
          <View style={styles.table}>
            <View style={styles.trHead}>
              <Text style={styles.colSr}>#</Text>
              <Text style={styles.colDesc}>Month</Text>
              <Text style={styles.colAmt}>Gross</Text>
              <Text style={styles.colAmt}>TDS</Text>
            </View>
            {months.map((m, i) => (
              <View key={`${m.year}-${m.month}`} style={i === months.length - 1 ? styles.trLast : styles.tr}>
                <Text style={styles.colSr}>{i + 1}</Text>
                <Text style={styles.colDesc}>{MONTHS[m.month - 1]} {m.year}</Text>
                <Text style={styles.colAmt}>{inr(m.grossEarnings)}</Text>
                <Text style={styles.colAmt}>{inr(m.tds)}</Text>
              </View>
            ))}
            <View style={styles.trTotal}>
              <Text style={styles.colSr}></Text>
              <Text style={styles.colDescBold}>Total TDS deducted</Text>
              <Text style={styles.colAmt}>{inr(months.reduce((s, m) => s + m.grossEarnings, 0))}</Text>
              <Text style={styles.colAmtBold}>{inr(totals.tdsDeducted)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Net tax payable / (refundable)</Text>
          <View style={styles.table}>
            <View style={styles.trTotal}>
              <Text style={styles.colSr}>7</Text>
              <Text style={styles.colDescBold}>
                {totals.taxRefundable >= 0 ? 'Refundable (TDS − tax payable)' : 'Balance tax payable'}
              </Text>
              <Text style={styles.colAmtBold}>{inr(totals.taxRefundable)}</Text>
            </View>
          </View>
          <Text style={{ marginTop: 4, fontSize: 8.5, color: colors.muted, fontStyle: 'italic' }}>
            {rupeesInWords(totals.taxRefundable)}
          </Text>
        </View>

        <Text style={styles.footnote}>
          This is a computer-generated Form 16 Part B for internal use and reconciliation. The authoritative
          Form 16 is downloaded from TRACES after Q4 filing. For any corrections contact HR / Payroll.
        </Text>
      </Page>
    </Document>
  )
}
