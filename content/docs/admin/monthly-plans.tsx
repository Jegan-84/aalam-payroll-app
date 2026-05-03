import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'monthly-plans',
  title: 'Monthly plans — intent calendar & report',
  summary: 'Employees mark WFH / planned leaves on a calendar; HR gets a per-employee report for capacity planning.',
  group: 'Leave',
}

export default function Article() {
  return (
    <>
      <h2>What this is</h2>
      <p>
        Each employee gets an intent calendar at <code>/me/plan</code>. They mark each day as one of:
      </p>
      <ul>
        <li><strong>WFH</strong> — working from home that day.</li>
        <li><strong>1st-half leave</strong> — out for the morning, working in the afternoon.</li>
        <li><strong>2nd-half leave</strong> — working in the morning, out in the afternoon.</li>
        <li><strong>Full-day leave</strong> — out the whole day.</li>
      </ul>
      <p>
        It&apos;s a <strong>planning tool</strong>, not a leave request. No leave balance is deducted automatically.
        Employees still file formal leave applications via <code>/leave</code> for actual balance impact.
      </p>

      <h2>How employees fill it</h2>
      <p>
        The calendar holds edits in client state — clicking a day opens a modal where the employee picks the
        plan type (and leave type for non-WFH). Edits stage locally; nothing hits the database until they
        click <strong>Save</strong> on the sticky action bar at the top (<kbd>Ctrl/Cmd+S</kbd> works too).
        Save is a <em>bulk replace</em> — every plan entry for that month is rewritten from the current
        client state.
      </p>

      <h2>The Monthly Plan report</h2>
      <p>
        <code>/leave/plan-report</code> aggregates plans across the org for a single month. Open to
        <code> admin</code>, <code>hr</code>, <code>payroll</code>. The page shows:
      </p>
      <ul>
        <li>
          A header strip with four stats: <strong>plans-filed coverage</strong> (X / N employees), total
          WFH days, total full-day leave, total leave days (halves count as 0.5).
        </li>
        <li>
          A per-employee table with one row per active employee — counts for WFH, 1st-half, 2nd-half,
          full-day, total leave days, leave-type breakdown (e.g. <code>SL · 2</code>, <code>PL · 0.5</code>),
          and a <em>Filed</em> / <em>No plan</em> status chip.
        </li>
        <li>Employees who haven&apos;t filed a plan are highlighted amber so they&apos;re easy to spot.</li>
      </ul>

      <h2>Filters</h2>
      <ul>
        <li><strong>Month picker</strong> — pick any month. Prev / This month / Next presets in the toolbar.</li>
        <li><strong>Employee filter</strong> — drill into a single employee&apos;s plan summary.</li>
      </ul>

      <h2>CSV export</h2>
      <p>
        The <strong>Download CSV</strong> button gives you one row per employee for the selected month, with
        columns for code, name, WFH days, half-day counts, full-day count, total leave days, status, and
        leave-type breakdown.
      </p>

      <h2>Half-day arithmetic</h2>
      <p>
        Half-day plans (1st-half / 2nd-half) count as <strong>0.5</strong> in the totals. So an employee
        with 1 full-day SL and 2 first-half PL entries shows: <code>fullDay=1, firstHalf=2, totalLeaveDays=2.0</code>
        and breakdown <code>SL · 1, PL · 1</code>.
      </p>

      <h2>Why this matters</h2>
      <p>
        It&apos;s a coverage view, not a payroll input. Use it to:
      </p>
      <ul>
        <li>Spot weeks where too many people are out (capacity planning).</li>
        <li>Nudge employees who haven&apos;t filled their plan yet (the amber rows).</li>
        <li>Cross-check that planned leaves became actual leave applications later.</li>
      </ul>

      <div className="callout callout-info">
        <strong>Note:</strong> Plans don&apos;t affect attendance, leave balance, or timesheet. They&apos;re purely
        informational. Reconcile actual leave consumption via <code>/leave</code> and <code>/timesheet/reconciliation</code>.
      </div>
    </>
  )
}
