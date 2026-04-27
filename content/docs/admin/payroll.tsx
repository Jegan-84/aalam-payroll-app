import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'payroll',
  title: 'Payroll cycle',
  summary: 'New cycle → compute → review → approve → reports. The monthly run-of-show.',
  group: 'Payroll',
}

export default function Article() {
  return (
    <>
      <h2>Cycle states</h2>
      <ul>
        <li><code>draft</code> — created but not computed yet.</li>
        <li><code>computed</code> — every employee has a payslip row; numbers visible for review.</li>
        <li><code>approved</code> — locked. Reimbursements / encashments marked paid; loan EMIs posted.</li>
        <li><code>paid</code> — bank file generated; payment confirmed (manual flag).</li>
      </ul>

      <h2>1. Create the cycle</h2>
      <p>
        <code>/payroll</code> → <strong>+ New cycle</strong>. Pick the month. The cycle covers calendar
        days 1 → 30/31 of that month. Pay date defaults to the last working day; override if needed.
      </p>

      <h2>2. Compute</h2>
      <p>
        Click <strong>Compute</strong> on the cycle. For every active employee, the engine pulls:
      </p>
      <ul>
        <li><strong>Salary structure</strong> — BASIC, HRA, Conveyance, Special.</li>
        <li><strong>Attendance &amp; leave</strong> — paid days, LOP days. LOP reduces gross proportionally.</li>
        <li><strong>Recurring components</strong> — lunch (₹250), shift allowance, custom earnings/deductions.</li>
        <li><strong>Reimbursements</strong> — pending claims become <code>REIMB_*</code> earning lines.</li>
        <li><strong>Leave encashment queue</strong> — <code>LEAVE_ENC_&lt;year&gt;</code> earning if December year-end was run.</li>
        <li><strong>Variable pay</strong> — if the cycle is a VP month, the per-employee VP allocation is added.</li>
        <li><strong>Loan EMIs</strong> — auto-deducted; perquisite added to taxable income if interest is concessional.</li>
        <li><strong>Statutory</strong> — PF, ESI, PT, TDS.</li>
      </ul>

      <h2>3. Review</h2>
      <p>
        On the cycle page, every employee has a Review link. The detail page (<code>/payroll/&#91;cycleId&#93;/&#91;employeeId&#93;</code>)
        shows every line item and lets you tweak per-employee overrides (one-off bonus, deduction).
      </p>
      <p>
        Use the <strong>Variance report</strong> to spot anomalies — anyone whose net pay swung &gt; ±10%
        from last month. Common reasons: LOP (attendance / leave overspend), VP, encashment, loan
        closure, regime change.
      </p>

      <h2>4. Approve</h2>
      <p>
        One click. The action is non-trivial:
      </p>
      <ul>
        <li>Locks the cycle (no further edits without reopen).</li>
        <li>Marks all reimbursement claims included in this cycle as <code>paid</code>.</li>
        <li>Marks leave encashment queue rows as paid.</li>
        <li>Posts loan EMI ledger entries (decreases outstanding principal).</li>
        <li>Generates payslips PDF for every employee.</li>
      </ul>
      <div className="callout callout-warn">
        <strong>Reopening:</strong> if you find an error post-approve, use <strong>Reopen</strong>.
        It reverses the same actions atomically — reimbursements go back to <code>approved</code>,
        encashments back to <code>pending</code>, loan EMIs are reversed. Then re-approve after
        fixing.
      </div>

      <h2>5. Outputs</h2>
      <ul>
        <li><strong>Payslips</strong> — visible to the employee at /me/payslips.</li>
        <li><strong>MIS report</strong> — gross/net/PF/PT/TDS by company / department.</li>
        <li><strong>Variance report</strong> — month-over-month deltas.</li>
        <li><strong>Journal</strong> — posting entries for accounting.</li>
        <li><strong>Bank file</strong> — bulk transfer file for your bank&apos;s portal.</li>
        <li><strong>TDS challan</strong> — totals for the month, ready to remit on TRACES.</li>
      </ul>
    </>
  )
}
