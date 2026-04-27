import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'overview',
  title: 'Admin overview',
  summary: 'Map of the admin app — what each module is for and the typical month-on-month rhythm.',
  group: 'Getting started',
}

export default function Article() {
  return (
    <>
      <h2>Module map</h2>
      <ul>
        <li><strong>Employees</strong> — onboarding, edits, employment-type conversions, exits.</li>
        <li><strong>Salary structures &amp; templates</strong> — gross-to-component split per employee.</li>
        <li><strong>Attendance</strong> — daily attendance grid; LEAVE / LOP / HOLIDAY cells.</li>
        <li><strong>Leave</strong> + <strong>Leave Balances</strong> — applications, approvals, balances, year-end.</li>
        <li><strong>Comp Off</strong> — the request approval queue.</li>
        <li><strong>Payroll</strong> — monthly cycles: compute → review → approve.</li>
        <li><strong>Loans</strong>, <strong>Reimbursements</strong>, <strong>F&amp;F</strong> — feed the payroll cycle.</li>
        <li><strong>Tax Declarations</strong>, <strong>TDS &amp; Form 16</strong> — annual tax compliance.</li>
        <li><strong>Reports</strong> — MIS, variance, journal, bank file.</li>
        <li><strong>Settings</strong> — masters: companies, departments, designations, projects, locations, leave policies, holidays, statutory config, tax slabs, PT, custom pay components, users.</li>
      </ul>

      <h2>Calendars</h2>
      <ul>
        <li><strong>Payroll FY</strong>: Apr 1 → Mar 31. Drives tax slabs, Form 16, 24Q.</li>
        <li><strong>Leave year</strong>: Jan 1 → Dec 31. Drives balances, accruals, year-end PL→EL conversion.</li>
        <li><strong>Holiday FY</strong>: labelled per your choice (e.g., &quot;2026-27&quot;). Stored on each holiday row.</li>
      </ul>

      <h2>Monthly rhythm</h2>
      <ol>
        <li><strong>Early month</strong> — review pending leave / comp off / reimbursement queues.</li>
        <li><strong>Mid month</strong> — run leave accrual (if half-yearly month), update statutory if rates changed.</li>
        <li><strong>Cut-off</strong> — close attendance, run payroll cycle, review per-employee, fix variances.</li>
        <li><strong>Approve</strong> — one click locks the cycle, marks reimbursements &amp; encashments paid, posts loan EMIs.</li>
        <li><strong>Outputs</strong> — payslips, MIS, journal, bank file, TDS challan.</li>
      </ol>

      <h2>Quarterly &amp; annual</h2>
      <ul>
        <li><strong>Each quarter</strong> — file Form 24Q (Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar).</li>
        <li><strong>Dec 31</strong> — run leave year-end (PL → EL ≤ 6, rest encashed in January payroll).</li>
        <li><strong>Mar 31</strong> — Form 16 generation, declaration proofs reconciliation.</li>
      </ul>

      <h2>Roles</h2>
      <table>
        <thead><tr><th>Role</th><th>Can do</th></tr></thead>
        <tbody>
          <tr><td><code>admin</code></td><td>Everything, including settings &amp; user management.</td></tr>
          <tr><td><code>hr</code></td><td>Employees, leave, holidays, comp-off approvals. Cannot approve payroll cycles.</td></tr>
          <tr><td><code>payroll</code></td><td>Run/approve cycles, generate reports, TDS.</td></tr>
          <tr><td><code>employee</code></td><td>ESS only — <code>/me/*</code>.</td></tr>
        </tbody>
      </table>
    </>
  )
}
