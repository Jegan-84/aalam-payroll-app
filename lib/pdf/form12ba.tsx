import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export type Form12BAData = {
  employee: {
    name: string
    pan: string | null
    employee_code: string
    designation: string | null
  }
  employer: {
    name: string
    tan: string | null
    pan: string | null
    address: string | null
  }
  fy: { start: string; end: string; label: string }
  /** Each perquisite nature (e.g. "Loan perquisite — personal loan") with totals. */
  perquisites: Array<{
    srNo: number
    nature: string
    valuePerRules: number
    amountRecovered: number
    taxableValue: number
  }>
}

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 32, paddingHorizontal: 36, fontSize: 9.5, fontFamily: 'Helvetica', color: '#111', lineHeight: 1.35 },
  title: { fontSize: 12, fontWeight: 700, textAlign: 'center', marginBottom: 1 },
  subtitle: { fontSize: 9, textAlign: 'center', color: '#4B5563', marginBottom: 10 },
  box: { borderWidth: 1, borderColor: '#808080', borderStyle: 'solid', marginBottom: 8 },
  boxHeader: { backgroundColor: '#DDDDDD', paddingVertical: 4, paddingHorizontal: 6, fontWeight: 700, fontSize: 9.5 },
  row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E5E7EB', borderTopStyle: 'solid' },
  rowFirst: { flexDirection: 'row' },
  cell: { flex: 1, paddingHorizontal: 6, paddingVertical: 4 },
  label: { fontSize: 8, color: '#4B5563' },
  value: { fontSize: 9.5 },
  bold: { fontWeight: 700 },
  tableHead: { flexDirection: 'row', backgroundColor: '#F3F4F6', paddingVertical: 4, paddingHorizontal: 6 },
  tableRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#808080', borderTopStyle: 'solid', paddingVertical: 4, paddingHorizontal: 6 },
  colSr: { width: 32, fontSize: 9.5 },
  colNature: { flex: 1, fontSize: 9.5 },
  colValue: { width: 80, fontSize: 9.5, textAlign: 'right' },
  colRecovered: { width: 80, fontSize: 9.5, textAlign: 'right' },
  colTaxable: { width: 80, fontSize: 9.5, textAlign: 'right' },
  declaration: { marginTop: 14, fontSize: 8.5, lineHeight: 1.6 },
  signRow: { marginTop: 24, flexDirection: 'row', justifyContent: 'space-between' },
  signBlock: { width: '40%' },
  signLine: { borderTopWidth: 1, borderTopColor: '#111', borderTopStyle: 'solid', marginTop: 18, paddingTop: 2, fontSize: 8.5 },
  note: { fontSize: 8, color: '#4B5563', marginTop: 6 },
})

export function Form12BADocument({ data }: { data: Form12BAData }) {
  const totals = data.perquisites.reduce(
    (s, p) => ({
      value: s.value + p.valuePerRules,
      recovered: s.recovered + p.amountRecovered,
      taxable: s.taxable + p.taxableValue,
    }),
    { value: 0, recovered: 0, taxable: 0 },
  )

  return (
    <Document title={`Form 12BA — ${data.employee.name} — FY ${data.fy.label}`} author={data.employer.name}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>FORM NO. 12BA</Text>
        <Text style={styles.subtitle}>
          (See rule 26A(2)(b)) — Statement showing particulars of perquisites, other fringe benefits or amenities and profits in lieu of salary with value thereof
        </Text>

        {/* Employer */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>1. Name and address of employer</Text>
          <View style={styles.rowFirst}>
            <View style={styles.cell}><Text style={styles.label}>Name</Text><Text style={styles.value}>{data.employer.name}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Address</Text><Text style={styles.value}>{data.employer.address ?? '—'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>TAN of employer</Text><Text style={styles.value}>{data.employer.tan ?? '—'}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>PAN of employer</Text><Text style={styles.value}>{data.employer.pan ?? '—'}</Text></View>
          </View>
        </View>

        {/* Employee */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>2. Details of the employee</Text>
          <View style={styles.rowFirst}>
            <View style={styles.cell}><Text style={styles.label}>Name</Text><Text style={styles.value}>{data.employee.name}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>PAN</Text><Text style={styles.value}>{data.employee.pan ?? '—'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Employee code</Text><Text style={styles.value}>{data.employee.employee_code}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Designation</Text><Text style={styles.value}>{data.employee.designation ?? '—'}</Text></View>
          </View>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Financial year</Text><Text style={styles.value}>{data.fy.label} (1 April {data.fy.start.slice(0, 4)} – 31 March {data.fy.end.slice(0, 4)})</Text></View>
          </View>
        </View>

        {/* Perquisites table */}
        <View style={styles.box}>
          <Text style={styles.boxHeader}>3. Details of perquisites, other fringe benefits and amenities</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.colSr, styles.label]}>Sl No.</Text>
            <Text style={[styles.colNature, styles.label]}>Nature of perquisite</Text>
            <Text style={[styles.colValue, styles.label]}>Value as per rules (₹)</Text>
            <Text style={[styles.colRecovered, styles.label]}>Amount recovered (₹)</Text>
            <Text style={[styles.colTaxable, styles.label]}>Taxable value (₹)</Text>
          </View>
          {data.perquisites.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ color: '#4B5563' }}>No perquisites provided during the financial year.</Text>
            </View>
          ) : (
            data.perquisites.map((p) => (
              <View key={p.srNo} style={styles.tableRow}>
                <Text style={styles.colSr}>{p.srNo}</Text>
                <Text style={styles.colNature}>{p.nature}</Text>
                <Text style={styles.colValue}>{fmt(p.valuePerRules)}</Text>
                <Text style={styles.colRecovered}>{fmt(p.amountRecovered)}</Text>
                <Text style={styles.colTaxable}>{fmt(p.taxableValue)}</Text>
              </View>
            ))
          )}
          {data.perquisites.length > 0 && (
            <View style={[styles.tableRow, { backgroundColor: '#E7E7E7' }]}>
              <Text style={styles.colSr}>{' '}</Text>
              <Text style={[styles.colNature, styles.bold]}>Total</Text>
              <Text style={[styles.colValue, styles.bold]}>{fmt(totals.value)}</Text>
              <Text style={[styles.colRecovered, styles.bold]}>{fmt(totals.recovered)}</Text>
              <Text style={[styles.colTaxable, styles.bold]}>{fmt(totals.taxable)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.note}>
          Perquisite values are computed as per Income Tax Rules and Section 17(2) of the Income Tax Act. Loan
          perquisites follow Rule 3(7)(i) using the SBI prime lending rate.
        </Text>

        {/* Declaration */}
        <Text style={styles.declaration}>
          <Text style={styles.bold}>DECLARATION BY EMPLOYER</Text>
          {'\n'}
          I, ____________________, son/daughter of ____________________, working as ____________________ (designation) do hereby declare on behalf of {data.employer.name} that the information given above is based on the books of account, documents and other relevant records or information available with us and the details of value of each such perquisite are in accordance with section 17 and rules framed thereunder and that such information is true and correct.
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>Signature of the person responsible for deduction of tax</Text>
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>Place: ____________________  Date: ____________________</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
