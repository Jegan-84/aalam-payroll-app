import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { rupeesInWords } from '@/lib/pdf/number-to-words'

export type FnfPdfLine = {
  code: string
  name: string
  kind: 'earning' | 'deduction'
  amount: number
  source: 'auto' | 'manual'
}

export type FnfPdfData = {
  company: {
    name: string
    address?: string
    pan?: string | null
    gstin?: string | null
    logo_url?: string | null
    logo_buffer?: Buffer | null
  }
  employee: {
    code: string
    name: string
    pan: string | null
    department: string | null
    designation: string | null
    date_of_joining: string
    last_working_day: string
    bank_name: string | null
    bank_account: string | null
    bank_ifsc: string | null
    tax_regime: string
  }
  tenure: {
    service_days: number
    service_years: number
    gratuity_eligible: boolean
    notice_period_days: number
    notice_days_served: number
  }
  totals: {
    leave_encashment_days: number
    leave_encashment_amount: number
    gratuity_amount: number
    final_tds: number
    total_earnings: number
    total_deductions: number
    net_payout: number
    fy_gross_before_fnf: number
    fy_tds_before_fnf: number
  }
  lines: FnfPdfLine[]
  status: 'draft' | 'computed' | 'approved' | 'paid'
}

const colors = {
  border: '#808080',
  lightHeader: '#DDDDDD',
  totalsBand: '#E7E7E7',
  muted: '#4B5563',
  text: '#111111',
}

const fmt = (n: number): string =>
  '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 24, paddingHorizontal: 36, fontSize: 10, fontFamily: 'Helvetica', color: colors.text, lineHeight: 1.35 },
  header: { alignItems: 'center', marginBottom: 8 },
  logo: { width: 42, height: 42, marginBottom: 2 },
  title: { fontSize: 13, fontWeight: 700 },
  subtitle: { fontSize: 9, color: colors.muted },
  box: { borderWidth: 1, borderColor: colors.border, borderStyle: 'solid', marginTop: 8 },
  boxHeader: { backgroundColor: colors.lightHeader, paddingVertical: 4, paddingHorizontal: 6, fontWeight: 700, fontSize: 10 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, paddingHorizontal: 6, paddingVertical: 4 },
  cellR: { flex: 1, paddingHorizontal: 6, paddingVertical: 4, textAlign: 'right' },
  label: { fontSize: 8, color: colors.muted },
  value: { fontSize: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, borderTopStyle: 'solid' },
  tableRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border, borderTopStyle: 'solid' },
  th: { paddingHorizontal: 6, paddingVertical: 4, fontSize: 9, fontWeight: 700, color: colors.muted },
  td: { paddingHorizontal: 6, paddingVertical: 3, fontSize: 10 },
  tdR: { paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, textAlign: 'right' },
  totalsBand: { backgroundColor: colors.totalsBand, paddingVertical: 6, paddingHorizontal: 6, marginTop: 8, borderWidth: 1, borderColor: colors.border, borderStyle: 'solid' },
  bigTotal: { fontSize: 12, fontWeight: 700, textAlign: 'right' },
  watermark: { position: 'absolute', top: '40%', left: 0, right: 0, fontSize: 54, color: '#F2F2F2', textAlign: 'center', fontWeight: 700 },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, fontSize: 8, color: colors.muted, textAlign: 'center' },
})

export function FnfDocument({ data }: { data: FnfPdfData }) {
  const earnings = data.lines.filter((l) => l.kind === 'earning')
  const deductions = data.lines.filter((l) => l.kind === 'deduction')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.status === 'draft' && <Text style={styles.watermark}>DRAFT</Text>}

        <View style={styles.header}>
          {data.company.logo_buffer ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop
            <Image style={styles.logo} src={data.company.logo_buffer} />
          ) : null}
          <Text style={styles.title}>{data.company.name}</Text>
          {data.company.address ? <Text style={styles.subtitle}>{data.company.address}</Text> : null}
          {data.company.pan ? <Text style={styles.subtitle}>PAN: {data.company.pan}</Text> : null}
          <Text style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>Full &amp; Final Settlement Statement</Text>
          <Text style={styles.subtitle}>Last working day: {data.employee.last_working_day}</Text>
        </View>

        {/* Employee + tenure block */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>Employee</Text>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Name</Text><Text style={styles.value}>{data.employee.name}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Employee code</Text><Text style={styles.value}>{data.employee.code}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>PAN</Text><Text style={styles.value}>{data.employee.pan ?? '—'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Tax regime</Text><Text style={styles.value}>{data.employee.tax_regime}</Text></View>
          </View>
          <View style={[styles.row, styles.divider]}>
            <View style={styles.cell}><Text style={styles.label}>Department</Text><Text style={styles.value}>{data.employee.department ?? '—'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Designation</Text><Text style={styles.value}>{data.employee.designation ?? '—'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Date of joining</Text><Text style={styles.value}>{data.employee.date_of_joining}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Last working day</Text><Text style={styles.value}>{data.employee.last_working_day}</Text></View>
          </View>
          <View style={[styles.row, styles.divider]}>
            <View style={styles.cell}><Text style={styles.label}>Service</Text><Text style={styles.value}>{data.tenure.service_days} days ({data.tenure.service_years} yrs)</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Gratuity eligible</Text><Text style={styles.value}>{data.tenure.gratuity_eligible ? 'Yes' : 'No'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Notice period</Text><Text style={styles.value}>{data.tenure.notice_period_days} days</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Notice served</Text><Text style={styles.value}>{data.tenure.notice_days_served} days</Text></View>
          </View>
        </View>

        {/* Earnings + Deductions side by side */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={[styles.box, { flex: 1, marginRight: 4 }]}>
            <Text style={styles.boxHeader}>Earnings</Text>
            <View style={[styles.row, styles.divider]}>
              <Text style={[styles.th, { flex: 2 }]}>Component</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Amount ₹</Text>
            </View>
            {earnings.length === 0 && (
              <View style={styles.tableRow}><Text style={[styles.td, { flex: 3, color: colors.muted }]}>No earnings.</Text></View>
            )}
            {earnings.map((l) => (
              <View key={l.code + l.name} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 2 }]}>{l.name}</Text>
                <Text style={[styles.tdR, { flex: 1 }]}>{fmt(l.amount)}</Text>
              </View>
            ))}
            <View style={[styles.tableRow, { backgroundColor: colors.totalsBand }]}>
              <Text style={[styles.td, { flex: 2, fontWeight: 700 }]}>Total earnings</Text>
              <Text style={[styles.tdR, { flex: 1, fontWeight: 700 }]}>{fmt(data.totals.total_earnings)}</Text>
            </View>
          </View>

          <View style={[styles.box, { flex: 1, marginLeft: 4 }]}>
            <Text style={styles.boxHeader}>Deductions</Text>
            <View style={[styles.row, styles.divider]}>
              <Text style={[styles.th, { flex: 2 }]}>Component</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Amount ₹</Text>
            </View>
            {deductions.length === 0 && (
              <View style={styles.tableRow}><Text style={[styles.td, { flex: 3, color: colors.muted }]}>No deductions.</Text></View>
            )}
            {deductions.map((l) => (
              <View key={l.code + l.name} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 2 }]}>{l.name}</Text>
                <Text style={[styles.tdR, { flex: 1 }]}>{fmt(l.amount)}</Text>
              </View>
            ))}
            <View style={[styles.tableRow, { backgroundColor: colors.totalsBand }]}>
              <Text style={[styles.td, { flex: 2, fontWeight: 700 }]}>Total deductions</Text>
              <Text style={[styles.tdR, { flex: 1, fontWeight: 700 }]}>{fmt(data.totals.total_deductions)}</Text>
            </View>
          </View>
        </View>

        {/* Net payout band */}
        <View style={styles.totalsBand}>
          <View style={styles.row}>
            <Text style={[styles.value, { flex: 1 }]}>Net payout (Earnings − Deductions)</Text>
            <Text style={[styles.bigTotal, { flex: 1 }]}>{fmt(data.totals.net_payout)}</Text>
          </View>
          <Text style={[styles.label, { marginTop: 2 }]}>In words: {rupeesInWords(data.totals.net_payout)}</Text>
        </View>

        {/* Reconciliation */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>Tax reconciliation (FY {data.employee.last_working_day.slice(0, 4)})</Text>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>FY gross before F&amp;F</Text><Text style={styles.value}>{fmt(data.totals.fy_gross_before_fnf)}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>FY TDS before F&amp;F</Text><Text style={styles.value}>{fmt(data.totals.fy_tds_before_fnf)}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Final TDS (F&amp;F)</Text><Text style={styles.value}>{fmt(data.totals.final_tds)}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Leave encashed</Text><Text style={styles.value}>{data.totals.leave_encashment_days.toFixed(1)} days · {fmt(data.totals.leave_encashment_amount)}</Text></View>
          </View>
        </View>

        {/* Bank + signature */}
        <View style={[styles.box]}>
          <Text style={styles.boxHeader}>Payout details</Text>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Bank</Text><Text style={styles.value}>{data.employee.bank_name ?? '—'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Account</Text><Text style={styles.value}>{data.employee.bank_account ?? '—'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>IFSC</Text><Text style={styles.value}>{data.employee.bank_ifsc ?? '—'}</Text></View>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a system-generated F&amp;F statement. Accepting this settlement releases the employer from further claims for the service period above.
        </Text>
      </Page>
    </Document>
  )
}
