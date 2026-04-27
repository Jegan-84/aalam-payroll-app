import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'leave-balances',
  title: 'Leave balances — seed, allocate, adjust',
  summary: 'Seed balances at the start of the leave year, allocate prorated leaves to new joiners, grant special leave, and adjust per-employee.',
  group: 'Leave',
}

export default function Article() {
  return (
    <>
      <h2>The grid</h2>
      <p>
        <code>/leave/balances</code> shows one row per active employee with a column per paid leave
        type. Each cell shows <strong>current balance</strong> (computed) plus a small line with
        <code> used</code> / <code>opening</code> / <code>adj</code> for context.
      </p>

      <h2>Seeding the year</h2>
      <p>
        Click <strong>Seed FY</strong> in the page header at the start of every leave year (or after
        adding new leave types). It walks every active employee × every paid leave type and inserts a
        row, honouring eligibility per employment type.
      </p>
      <ul>
        <li><code>annual</code> types — opening_balance = full quota.</li>
        <li><code>half_yearly</code> / <code>monthly</code> — opening = 0; the next accrual run credits them.</li>
      </ul>
      <p>Seeding is idempotent — existing rows aren&apos;t touched.</p>

      <h2>New joiner allocation (prorated)</h2>
      <p>
        For an employee whose DOJ falls inside the current leave year, click the <strong>New joiner</strong>
        tab on the Joiner allocation card. Pick the employee and click Allocate.
      </p>
      <ul>
        <li>Annual quotas scale by months remaining: <code>quota × (months_remaining / 12)</code>, rounded to 0.5d.</li>
        <li>Half-yearly / monthly types start at 0.</li>
        <li>Existing rows aren&apos;t overwritten.</li>
        <li>Optional DOJ override field for backdated cases.</li>
      </ul>

      <h2>Special grant (Maternity, Paternity, etc.)</h2>
      <p>
        Switch to the <strong>Special grant</strong> tab. Grant any leave type to a specific employee —
        even outside the type&apos;s eligibility. Pick employee, type, days, reason → Grant.
      </p>
      <p>
        The action adds <code>days</code> to the row&apos;s <code>opening_balance</code>, appends a stamped
        note, and writes an audit log entry. After this, the employee can apply for that type through
        the regular leave flow.
      </p>

      <h2>Per-cell adjustment</h2>
      <p>
        Each balance cell has an <strong>Adjust</strong> link. The dialog shows all 6 raw columns
        (opening, accrued, carry-fwd, used, encashed, current adjustment) and lets you set a new
        value for the <code>adjustment</code> column. A live preview shows the resulting balance.
      </p>
      <ul>
        <li>Positive = grant extra days. Negative = claw back.</li>
        <li><strong>Replaces</strong> the existing adjustment, doesn&apos;t add to it.</li>
        <li>Notes are mandatory; they&apos;re stamped onto the row&apos;s notes column and the audit log.</li>
      </ul>

      <h2>Convention summary</h2>
      <table>
        <thead><tr><th>Need</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td>Start a new leave year</td><td>Seed FY button</td></tr>
          <tr><td>Mid-year hire</td><td>New joiner tab</td></tr>
          <tr><td>Mid-year employment-type change</td><td>Convert button on the employee page</td></tr>
          <tr><td>One-off allocation (Maternity, etc.)</td><td>Special grant tab</td></tr>
          <tr><td>Fix a number for a specific person</td><td>Adjust dialog (per cell)</td></tr>
          <tr><td>Year-end PL → EL + encashment</td><td>Year-end button</td></tr>
        </tbody>
      </table>
    </>
  )
}
