import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { MONTH_NAMES } from '@/lib/attendance/engine'
import { rupeesInWords } from '@/lib/pdf/number-to-words'

export type PayslipComponent = {
  code: string
  name: string
  kind: 'earning' | 'deduction' | 'employer_retiral' | 'reimbursement' | 'variable' | 'perquisite'
  amount: number
  display_order: number
}

export type PayslipData = {
  org: {
    name: string
    address?: string
    gstin?: string | null
    pan?: string | null
    logo_url?: string | null
    logo_buffer?: Buffer | null
  }
  cycle: { year: number; month: number }
  item: {
    employee_code: string
    employee_name: string
    pan: string | null
    department: string | null
    designation: string | null
    location: string | null
    bank_name: string | null
    bank_account: string | null
    bank_ifsc: string | null
    tax_regime: string | null
    days_in_month: number
    paid_days: number
    lop_days: number
    leave_days: number
    proration_factor: number
    total_earnings: number
    total_deductions: number
    net_pay: number
    employer_retirals: number
    monthly_tds: number

    // Added for new layout
    date_of_joining: string | null
    uan_number: string | null
    esi_number: string | null
  }
  components: PayslipComponent[]
}

const colors = {
  border: '#808080',
  lightHeader: '#DDDDDD',
  totalsBand: '#E7E7E7',
  muted: '#4B5563',
  text: '#111111',
}

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.text,
    lineHeight: 1.35,
  },

  // Header
  headerBlock: { alignItems: 'center' },
  logo: { width: 42, height: 42, marginBottom: 2 },
  logoFallback: {
    fontSize: 8, color: colors.muted, marginBottom: 2,
  },
  orgName: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  orgAddress: { fontSize: 10, textAlign: 'center', marginTop: 2 },
  payslipTitle: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginTop: 10, marginBottom: 12 },

  // Employee info grid — 6 rows × 4 cells (label, value, label, value)
  infoTable: {
    borderWidth: 1, borderColor: colors.border,
    borderBottomWidth: 0,
  },
  infoRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLabel: {
    width: '22%',
    paddingVertical: 5, paddingHorizontal: 8,
    fontWeight: 'bold',
    borderRightWidth: 1, borderRightColor: colors.border,
    backgroundColor: colors.lightHeader,
    fontSize: 9.5,
  },
  infoValue: {
    width: '28%',
    paddingVertical: 5, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 9.5,
  },
  infoValueLast: {
    width: '28%',
    paddingVertical: 5, paddingHorizontal: 8,
    fontSize: 9.5,
  },

  spacer12: { height: 12 },

  // Main earnings/deductions table
  mainTable: {
    borderWidth: 1, borderColor: colors.border,
    borderBottomWidth: 0,
  },
  bandRow: {
    flexDirection: 'row',
    backgroundColor: colors.lightHeader,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bandHalf: {
    width: '50%',
    paddingVertical: 6,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 10.5,
  },
  bandHalfDivider: {
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  subHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  colComp: {
    width: '35%',
    paddingVertical: 5, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 9.5, fontWeight: 'bold',
  },
  colAmt: {
    width: '15%',
    paddingVertical: 5, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 9.5, fontWeight: 'bold',
    textAlign: 'right',
  },
  colAmtLast: {
    width: '15%',
    paddingVertical: 5, paddingHorizontal: 8,
    fontSize: 9.5, fontWeight: 'bold',
    textAlign: 'right',
  },

  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cellComp: {
    width: '35%',
    paddingVertical: 4.5, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 9.5,
  },
  cellAmt: {
    width: '15%',
    paddingVertical: 4.5, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 9.5,
    textAlign: 'right',
  },
  cellAmtLast: {
    width: '15%',
    paddingVertical: 4.5, paddingHorizontal: 8,
    fontSize: 9.5,
    textAlign: 'right',
  },
  cellCompEmpty: {
    width: '35%',
    paddingVertical: 4.5, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  cellAmtEmpty: {
    width: '15%',
    paddingVertical: 4.5, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  cellAmtEmptyLast: {
    width: '15%',
    paddingVertical: 4.5, paddingHorizontal: 8,
  },

  totalsRow: {
    flexDirection: 'row',
    backgroundColor: colors.totalsBand,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  totalsLabel: {
    width: '35%',
    paddingVertical: 6, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 10, fontWeight: 'bold',
  },
  totalsAmt: {
    width: '15%',
    paddingVertical: 6, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 10, fontWeight: 'bold',
    textAlign: 'right',
  },
  totalsAmtLast: {
    width: '15%',
    paddingVertical: 6, paddingHorizontal: 8,
    fontSize: 10, fontWeight: 'bold',
    textAlign: 'right',
  },

  netPayRow: {
    flexDirection: 'row',
    backgroundColor: colors.totalsBand,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  netLabel: {
    width: '35%',
    paddingVertical: 7, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 10.5, fontWeight: 'bold',
  },
  netAmt: {
    width: '15%',
    paddingVertical: 7, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: colors.border,
    fontSize: 10.5, fontWeight: 'bold',
    textAlign: 'right',
  },
  netBlank: {
    width: '50%',
    paddingVertical: 7, paddingHorizontal: 8,
  },

  // Footer
  inWords: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold',
  },
  footerNote: {
    marginTop: 28,
    textAlign: 'right',
    fontSize: 8.5,
    color: colors.muted,
    fontStyle: 'italic',
  },
})

function InfoCell({ label, value, last }: { label: string; value: string | null; last?: boolean }) {
  return (
    <>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={last ? styles.infoValueLast : styles.infoValue}>{value || ''}</Text>
    </>
  )
}

function DataRow({ left, right, last }: {
  left: { name: string; amount: number } | null
  right: { name: string; amount: number } | null
  last?: boolean
}) {
  return (
    <View style={last ? { ...styles.dataRow, borderBottomWidth: 0 } : styles.dataRow}>
      {left ? (
        <>
          <Text style={styles.cellComp}>{left.name}</Text>
          <Text style={styles.cellAmt}>{fmt(left.amount)}</Text>
        </>
      ) : (
        <>
          <Text style={styles.cellCompEmpty}>{' '}</Text>
          <Text style={styles.cellAmtEmpty}>{' '}</Text>
        </>
      )}
      {right ? (
        <>
          <Text style={styles.cellComp}>{right.name}</Text>
          <Text style={styles.cellAmtLast}>{fmt(right.amount)}</Text>
        </>
      ) : (
        <>
          <Text style={styles.cellCompEmpty}>{' '}</Text>
          <Text style={styles.cellAmtEmptyLast}>{' '}</Text>
        </>
      )}
    </View>
  )
}

export function PayslipDocument({ data }: { data: PayslipData }) {
  const { org, cycle, item, components } = data

  const comps = [...components].sort((a, b) => a.display_order - b.display_order)
  const earnings = comps.filter((c) => c.kind === 'earning' && c.amount !== 0)
  const deductions = comps.filter((c) => c.kind === 'deduction' && c.amount !== 0)
  // Loan perquisites are notional (used only for TDS, not paid). Hidden from
  // the payslip — the perquisite value is already folded into TDS. Keep the
  // array empty so the existing render guards become no-ops.
  const perquisites: typeof comps = []

  const rows = Math.max(earnings.length, deductions.length, 5)
  const paddedRows: Array<{ left: { name: string; amount: number } | null; right: { name: string; amount: number } | null }> = []
  for (let i = 0; i < rows; i++) {
    paddedRows.push({
      left: earnings[i] ? { name: earnings[i].name, amount: earnings[i].amount } : null,
      right: deductions[i] ? { name: deductions[i].name, amount: deductions[i].amount } : null,
    })
  }

  const monthYear = `${MONTH_NAMES[cycle.month - 1]} ${cycle.year}`.toUpperCase()

  return (
    <Document title={`Payslip ${item.employee_code} ${MONTH_NAMES[cycle.month - 1]} ${cycle.year}`} author={org.name}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBlock}>
          {org.logo_url ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt prop
            <Image src={org.logo_url} style={styles.logo} />
          ) : org.logo_buffer ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={{ data: org.logo_buffer, format: 'png' }} style={styles.logo} />
          ) : null}
          <Text style={styles.orgName}>{org.name}</Text>
          {org.address ? <Text style={styles.orgAddress}>{org.address}</Text> : null}
          <Text style={styles.payslipTitle}>PAYSLIP FOR THE MONTH OF {monthYear}</Text>
        </View>

        {/* Employee info grid — 6 rows × (label, value, label, value) */}
        <View style={styles.infoTable}>
          <View style={styles.infoRow}>
            <InfoCell label="Employee Code" value={item.employee_code} />
            <InfoCell label="Employee Name" value={item.employee_name} last />
          </View>
          <View style={styles.infoRow}>
            <InfoCell label="Bank Name" value={item.bank_name} />
            <InfoCell label="Bank Account Number" value={item.bank_account} last />
          </View>
          <View style={styles.infoRow}>
            <InfoCell label="Department" value={item.department} />
            <InfoCell label="PF Account No." value={item.uan_number} last />
          </View>
          <View style={styles.infoRow}>
            <InfoCell label="Designation" value={item.designation} />
            <InfoCell label="ESI Location" value={item.esi_number || 'Nil'} last />
          </View>
          <View style={styles.infoRow}>
            <InfoCell label="Date of Joining" value={item.date_of_joining} />
            <InfoCell label="UAN Number" value={item.uan_number} last />
          </View>
          <View style={styles.infoRow}>
            <InfoCell label="Paid Days" value={String(item.paid_days)} />
            <InfoCell label="PAN/GIR No.(TDS)" value={item.pan} last />
          </View>
        </View>

        <View style={styles.spacer12} />

        {/* Earnings / Deductions table */}
        <View style={styles.mainTable}>
          <View style={styles.bandRow}>
            <Text style={[styles.bandHalf, styles.bandHalfDivider]}>EARNINGS</Text>
            <Text style={styles.bandHalf}>DEDUCTIONS</Text>
          </View>

          <View style={styles.subHeaderRow}>
            <Text style={styles.colComp}>COMPONENT</Text>
            <Text style={styles.colAmt}>ACTUAL AMOUNT</Text>
            <Text style={styles.colComp}>COMPONENT</Text>
            <Text style={styles.colAmtLast}>ACTUAL AMOUNT</Text>
          </View>

          {paddedRows.map((r, i) => (
            <DataRow key={i} left={r.left} right={r.right} />
          ))}

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Gross Pay</Text>
            <Text style={styles.totalsAmt}>{fmt(item.total_earnings)}</Text>
            <Text style={styles.totalsLabel}>TOTAL Deduction</Text>
            <Text style={styles.totalsAmtLast}>{fmt(item.total_deductions)}</Text>
          </View>

          <View style={[styles.netPayRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.netLabel}>Net Pay</Text>
            <Text style={styles.netAmt}>{fmt(item.net_pay)}</Text>
            <Text style={styles.netBlank}>{' '}</Text>
          </View>
        </View>

        <Text style={styles.inWords}>In Words: ({rupeesInWords(item.net_pay)})</Text>

        {perquisites.length > 0 && (
          <View style={[styles.mainTable, { marginTop: 10 }]}>
            <View style={styles.bandRow}>
              <Text style={[styles.bandHalf, styles.bandHalfDivider]}>NOTIONAL PERQUISITES (TAXABLE, NOT PAID)</Text>
              <Text style={styles.bandHalf}>AMOUNT</Text>
            </View>
            {perquisites.map((p) => (
              <View key={p.code} style={styles.dataRow}>
                <Text style={styles.colComp}>{p.name}</Text>
                <Text style={styles.colAmt}>{fmt(p.amount)}</Text>
                <Text style={styles.colComp}>{' '}</Text>
                <Text style={styles.colAmtLast}>{' '}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footerNote}>
          This is a system generated payslip hence signature is not required.
          {perquisites.length > 0 ? ' Perquisite values (s.17(2)(viii)) are included in taxable salary for TDS; they are not part of your net pay.' : ''}
        </Text>
      </Page>
    </Document>
  )
}
