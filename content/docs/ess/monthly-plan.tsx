import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'monthly-plan',
  title: 'Monthly plan',
  summary: 'Mark which days you’ll WFH or be on leave. It’s a planning calendar — not a leave request.',
  group: 'Time off',
}

export default function Article() {
  return (
    <>
      <h2>What this is</h2>
      <p>
        <code>/me/plan</code> is your <strong>intent calendar</strong>. Each day of the month, mark whether
        you&apos;ll be:
      </p>
      <ul>
        <li><strong>WFH</strong> — working from home that day.</li>
        <li><strong>1st-half leave</strong> — out for the morning, working in the afternoon.</li>
        <li><strong>2nd-half leave</strong> — working in the morning, out for the afternoon.</li>
        <li><strong>Full-day leave</strong> — out the whole day.</li>
      </ul>
      <p>
        It helps your manager and HR plan capacity — they can see who&apos;s out when. It does <strong>not</strong>
        consume leave balance. To actually take leave, file a leave application from <code>/me/leave</code>.
      </p>

      <h2>How to fill it</h2>
      <ol>
        <li>Open <code>/me/plan</code>. The current month is shown by default; use <code>‹ ›</code> to navigate.</li>
        <li>Click any in-month day. A modal opens.</li>
        <li>Pick the plan type. For leave types (1st-half / 2nd-half / Full-day), also pick the leave type
          (SL / PL / EL / COMP_OFF / LOP).</li>
        <li>Optional notes — e.g. &quot;Doctor&apos;s appointment&quot;, &quot;Focus day at home&quot;.</li>
        <li>Click <strong>Apply</strong>. The change is staged in your draft.</li>
        <li>Repeat for as many days as you want.</li>
      </ol>

      <h2>Save the month</h2>
      <p>
        Edits stay in a local draft until you click <strong>Save</strong> on the action bar at the top of the
        calendar (or press <kbd>Ctrl/Cmd + S</kbd>). The bar shows <em>&quot;Unsaved changes&quot;</em> in red while
        you have pending edits, and <em>&quot;All changes saved&quot;</em> in green once the server has them.
      </p>
      <p>
        Save replaces the entire month — every plan entry for the visible month is rewritten from your
        current draft. So if you cleared a day in the modal, that day&apos;s old plan disappears on Save.
      </p>

      <h2>Clearing a day</h2>
      <p>
        Open the day, click <strong>Clear day</strong>. The plan vanishes from the calendar (still in draft);
        click Save to commit.
      </p>

      <h2>Half-days count as 0.5</h2>
      <p>
        The summary at the top of the page shows <strong>Effective leave days</strong>: full-day = 1,
        half-day = 0.5. So 2 full-day leaves + 2 first-half leaves = 3.0 days.
      </p>

      <h2>Plans vs leave applications</h2>
      <table>
        <thead><tr><th>Monthly plan</th><th>Leave application</th></tr></thead>
        <tbody>
          <tr><td>Calendar UI at <code>/me/plan</code></td><td>Form at <code>/me/leave</code></td></tr>
          <tr><td>Per day, fill once a month</td><td>Per absence, file when needed</td></tr>
          <tr><td>Doesn&apos;t need approval</td><td>Goes to HR for approval</td></tr>
          <tr><td>Doesn&apos;t deduct leave balance</td><td>Deducts on approval</td></tr>
          <tr><td>For coverage / planning visibility</td><td>For payroll / attendance</td></tr>
        </tbody>
      </table>

      <div className="callout callout-info">
        <strong>Tip:</strong> Plan early. Mark the calendar at the start of the month so your manager knows
        when you&apos;ll be out. Then file the formal leave application a few days before each absence.
      </div>

      <h2>Holidays &amp; weekends</h2>
      <p>
        Project holidays and weekends are highlighted on the calendar in red — you can&apos;t plan on those
        days (they&apos;re already off). Only weekday cells in the current month are clickable.
      </p>
    </>
  )
}
