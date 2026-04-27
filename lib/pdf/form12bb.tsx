import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export type Form12BBData = {
  employee: {
    name: string
    pan: string | null
    employee_code: string
    designation: string | null
    department: string | null
  }
  employer: {
    name: string
    tan: string | null
    address: string | null
  }
  fy: { start: string; end: string; label: string }
  regime: 'NEW' | 'OLD'
  hra: {
    rent_paid_annual: number
    metro_city: boolean
    landlord_name: string | null
    landlord_pan: string | null
    landlord_address: string | null
  }
  home_loan: {
    interest_paid: number
    lender_name: string | null
    lender_pan: string | null
    lender_address: string | null
  }
  lta: {
    claimed: number
  }
  chapter_vi_a: Array<{ section: string; description: string; amount: number }>
  submitted_at: string | null
  approved_at: string | null
}

const fmt = (n: number): string =>
  '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 32, paddingHorizontal: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#111', lineHeight: 1.35 },
  title: { fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 2 },
  subtitle: { fontSize: 10, textAlign: 'center', color: '#4B5563', marginBottom: 10 },
  legalNote: { fontSize: 8, color: '#4B5563', marginBottom: 8, textAlign: 'center' },
  box: { borderWidth: 1, borderColor: '#808080', borderStyle: 'solid', marginBottom: 8 },
  boxHeader: { backgroundColor: '#DDDDDD', paddingVertical: 4, paddingHorizontal: 6, fontWeight: 700, fontSize: 10 },
  row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E5E7EB', borderTopStyle: 'solid' },
  rowFirst: { flexDirection: 'row' },
  cell: { flex: 1, paddingHorizontal: 6, paddingVertical: 4 },
  cellR: { flex: 1, paddingHorizontal: 6, paddingVertical: 4, textAlign: 'right' },
  label: { fontSize: 8, color: '#4B5563' },
  value: { fontSize: 10 },
  bold: { fontWeight: 700 },
  chapter: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E5E7EB', borderTopStyle: 'solid', paddingHorizontal: 6, paddingVertical: 3 },
  chapterSec: { width: 60, fontSize: 10, fontWeight: 700 },
  chapterDesc: { flex: 1, fontSize: 10 },
  chapterAmt: { width: 90, fontSize: 10, textAlign: 'right' },
  declaration: { marginTop: 10, fontSize: 9, lineHeight: 1.5 },
  signRow: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between' },
  signBlock: { width: '40%' },
  signLine: { borderTopWidth: 1, borderTopColor: '#111', borderTopStyle: 'solid', marginTop: 16, paddingTop: 2, fontSize: 9 },
})

export function Form12BBDocument({ data }: { data: Form12BBData }) {
  const totalChapter = data.chapter_vi_a.reduce((s, r) => s + r.amount, 0)
  const hraNeedsPan = data.hra.rent_paid_annual > 100000

  return (
    <Document title={`Form 12BB — ${data.employee.name} — FY ${data.fy.label}`} author={data.employer.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM NO. 12BB</Text>
        <Text style={styles.subtitle}>
          (See rule 26C) — Statement showing particulars of claims by an employee for deduction of tax under section 192
        </Text>
        <Text style={styles.legalNote}>
          For the Financial Year: {data.fy.label} (1 April {data.fy.start.slice(0, 4)} – 31 March {data.fy.end.slice(0, 4)})
          · Tax regime elected: <Text style={styles.bold}>{data.regime}</Text>
        </Text>

        {/* Employee block */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>1. Details of the employee</Text>
          <View style={styles.rowFirst}>
            <View style={styles.cell}><Text style={styles.label}>Name of the employee</Text><Text style={styles.value}>{data.employee.name}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>PAN of the employee</Text><Text style={styles.value}>{data.employee.pan ?? '—'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Employee code</Text><Text style={styles.value}>{data.employee.employee_code}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Designation</Text><Text style={styles.value}>{data.employee.designation ?? '—'}</Text></View>
          </View>
        </View>

        {/* HRA block */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>2. House Rent Allowance — Section 10(13A) particulars</Text>
          <View style={styles.rowFirst}>
            <View style={styles.cell}><Text style={styles.label}>Rent paid to landlord (annual)</Text><Text style={styles.value}>{fmt(data.hra.rent_paid_annual)}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Metro city (Mumbai / Delhi / Kolkata / Chennai)</Text><Text style={styles.value}>{data.hra.metro_city ? 'Yes' : 'No'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Name of landlord</Text><Text style={styles.value}>{data.hra.landlord_name ?? '—'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Address of landlord</Text><Text style={styles.value}>{data.hra.landlord_address ?? '—'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}>
              <Text style={styles.label}>PAN of landlord {hraNeedsPan ? '(required — rent exceeds ₹1,00,000 p.a.)' : '(optional — rent ≤ ₹1,00,000 p.a.)'}</Text>
              <Text style={styles.value}>{data.hra.landlord_pan ?? (hraNeedsPan ? 'NOT PROVIDED — add before submission' : '—')}</Text>
            </View>
          </View>
        </View>

        {/* LTA block */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>3. Leave Travel Concession — Section 10(5)</Text>
          <View style={styles.rowFirst}>
            <View style={styles.cell}><Text style={styles.label}>Amount claimed for LTA</Text><Text style={styles.value}>{fmt(data.lta.claimed)}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Evidence / particulars</Text><Text style={styles.value}>Attach tickets / proofs separately</Text></View>
          </View>
        </View>

        {/* Home loan block */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>4. Interest paid on home loan — Section 24(b)</Text>
          <View style={styles.rowFirst}>
            <View style={styles.cell}><Text style={styles.label}>Interest paid during the year</Text><Text style={styles.value}>{fmt(data.home_loan.interest_paid)}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Name of lender</Text><Text style={styles.value}>{data.home_loan.lender_name ?? '—'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>PAN of lender (required for interest &gt; ₹0)</Text><Text style={styles.value}>{data.home_loan.lender_pan ?? (data.home_loan.interest_paid > 0 ? 'NOT PROVIDED — add before submission' : '—')}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Address of lender</Text><Text style={styles.value}>{data.home_loan.lender_address ?? '—'}</Text></View>
          </View>
        </View>

        {/* Chapter VI-A */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>5. Deductions under Chapter VI-A</Text>
          <View style={{ flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#F3F4F6' }}>
            <Text style={[styles.chapterSec, styles.label]}>Section</Text>
            <Text style={[styles.chapterDesc, styles.label]}>Description</Text>
            <Text style={[styles.chapterAmt, styles.label]}>Amount claimed</Text>
          </View>
          {data.chapter_vi_a.length === 0 && (
            <View style={styles.chapter}><Text style={{ color: '#4B5563' }}>No Chapter VI-A deductions claimed.</Text></View>
          )}
          {data.chapter_vi_a.map((r, i) => (
            <View key={i} style={styles.chapter}>
              <Text style={styles.chapterSec}>{r.section}</Text>
              <Text style={styles.chapterDesc}>{r.description}</Text>
              <Text style={styles.chapterAmt}>{fmt(r.amount)}</Text>
            </View>
          ))}
          {data.chapter_vi_a.length > 0 && (
            <View style={[styles.chapter, { backgroundColor: '#E7E7E7' }]}>
              <Text style={[styles.chapterSec, styles.bold]}>Total</Text>
              <Text style={styles.chapterDesc}>{' '}</Text>
              <Text style={[styles.chapterAmt, styles.bold]}>{fmt(totalChapter)}</Text>
            </View>
          )}
        </View>

        {/* Verification */}
        <Text style={styles.declaration}>
          <Text style={styles.bold}>Verification.</Text> I, {data.employee.name}, son/daughter of ___________________, do hereby certify that the information given above is complete and correct.
          {'\n\n'}
          Place: ____________________    Date: {data.submitted_at?.slice(0, 10) ?? '____________________'}
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>Signature of the employee</Text>
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>Full Name: {data.employee.name}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
