import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'leave-policies',
  title: 'Leave policies & types',
  summary: 'Define leave types, set quotas, eligibility, accrual cadence, and run the monthly accrual.',
  group: 'Leave',
}

export default function Article() {
  return (
    <>
      <h2>Concepts</h2>
      <p>
        A <strong>leave type</strong> (PL, SL, EL, COMP_OFF, LOP, MATERNITY, etc.) defines the rules:
        annual quota, accrual cadence, carry-forward cap, max balance, encashable-on-exit, and which
        employment types are eligible. The page <code>/settings/leave-policies</code> manages all of this.
      </p>

      <h2>Editing an existing type</h2>
      <p>Each row on the page is editable inline. The fields:</p>
      <table>
        <thead><tr><th>Field</th><th>Effect</th></tr></thead>
        <tbody>
          <tr><td><code>annual_quota_days</code></td><td>Total days per leave year. Used for annual upfront grants and as the base for half-yearly accrual.</td></tr>
          <tr><td><code>accrual_type</code></td><td><code>annual</code> = whole quota at FY start. <code>half_yearly</code> = quota/2 in Jan and Jul. <code>monthly</code> = monthly_accrual_days each month. <code>none</code> = manual grants only.</td></tr>
          <tr><td><code>monthly_accrual_days</code></td><td>Days credited per month if accrual_type=monthly.</td></tr>
          <tr><td><code>carry_forward_max_days</code></td><td>Max days that carry into the next leave year.</td></tr>
          <tr><td><code>max_balance_days</code></td><td>Hard cap on balance. Accrual stops crediting once balance hits this.</td></tr>
          <tr><td><code>encashable_on_exit</code></td><td>If true, unused balance is encashed in F&amp;F.</td></tr>
          <tr><td><code>applicable_employment_types</code></td><td>Checkboxes for the 5 employment types. All ticked = applies to everyone (stored as null). None ticked = applies to none (only via Special Grant). Subset = exactly those.</td></tr>
        </tbody>
      </table>

      <h2>Creating a new type</h2>
      <p>
        Click <strong>+ New leave type</strong> on the policies page. Use cases:
      </p>
      <ul>
        <li><strong>Maternity / Paternity</strong> — set <code>accrual_type=none</code>, quota 0, eligibility ticked none. Then grant per-employee via <em>Special Grant</em> on /leave/balances.</li>
        <li><strong>Bereavement</strong> — same pattern; use Special Grant with a small day count when the case arises.</li>
        <li><strong>Sabbatical</strong> — quota high, accrual_type=none, encashable=false.</li>
      </ul>

      <h2>Running accrual</h2>
      <p>
        At the top of <code>/settings/leave-policies</code> there&apos;s a <strong>Run accrual</strong> form.
        Pick the year and month. The runner:
      </p>
      <ul>
        <li>For <code>monthly</code> types — credits <code>monthly_accrual_days</code> for that month, idempotent on the <code>last_accrued_yearmonth</code> marker.</li>
        <li>For <code>half_yearly</code> types — if the month is in H1, credits half of the annual quota with marker <code>YYYY-01</code>; same for H2 with <code>YYYY-07</code>. Re-running for any month inside the half is safe — it credits once and skips on re-runs.</li>
      </ul>
      <div className="callout callout-info">
        <strong>Cadence tip:</strong> run accrual on the 1st of every month. Half-yearly types only
        actually credit in Jan and Jul; the other 10 months are no-ops, but running anyway costs
        nothing and keeps the habit consistent.
      </div>

      <h2>Year-end conversion</h2>
      <p>
        Run on Dec 31 (or early January) from <code>/leave/balances</code> → Year-end button. For each
        employee with PL &gt; 0:
      </p>
      <ol>
        <li>If their EL is empty, transfer up to 6 PL → EL.</li>
        <li>Encash any remaining PL at <code>(monthly basic ÷ 30)</code> per day.</li>
        <li>The encashment is queued as a <code>LEAVE_ENC_&lt;year&gt;</code> earning that the next payroll cycle picks up.</li>
      </ol>
    </>
  )
}
