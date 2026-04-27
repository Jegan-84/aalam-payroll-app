import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'reports',
  title: 'Reports & exports',
  summary: 'MIS, variance, journal, bank file, plus reimbursement and loan summaries.',
  group: 'Payroll',
}

export default function Article() {
  return (
    <>
      <h2>MIS</h2>
      <p>
        <code>/reports/mis</code> — gross, net, PF, PT, TDS by company / department / cost centre,
        for any month. Used for management reporting and headcount-cost tracking.
      </p>

      <h2>Variance</h2>
      <p>
        <code>/reports/variance</code> — month-over-month delta per employee, sorted by largest swing.
        Useful before approving a cycle to spot anomalies. Top reasons:
      </p>
      <ul>
        <li>LOP days (attendance / leave overspend)</li>
        <li>VP month or one-off bonus</li>
        <li>Loan closure or new loan EMI</li>
        <li>Tax regime change</li>
        <li>New joiner / exit (pro-rata)</li>
      </ul>

      <h2>Journal</h2>
      <p>
        <code>/reports/journal</code> — accounting-friendly posting entries:
        Salary Expense Dr / PF Payable Cr / TDS Payable Cr / etc. Format suitable for paste-into your
        accounting system.
      </p>

      <h2>Bank file</h2>
      <p>
        From the cycle detail page, <strong>Download bank file</strong>. Format depends on the bank
        configured per company (default: ICICI / HDFC standard CSV). Upload to the bank&apos;s portal to
        trigger the bulk transfer.
      </p>

      <h2>Loan & reimbursement reports</h2>
      <ul>
        <li><code>/loans</code> — outstanding principal across all employees. Filterable by status.</li>
        <li><code>/reimbursements</code> — pending claims (queue), approved, paid in a specific cycle.</li>
      </ul>

      <h2>Auto-archival</h2>
      <p>
        Reports aren&apos;t persisted as PDF — they re-render from the underlying data each time. So they&apos;re
        always self-consistent with current cycle state. If you reopen a cycle, the report changes too.
        Snapshot via PDF print if you need a fixed copy for filing.
      </p>
    </>
  )
}
