import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'timesheet',
  title: 'Timesheet — reports & reconciliation',
  summary: 'Per-project / per-employee / per-activity hours, plus the leave-vs-timesheet mismatch report.',
  group: 'Timesheet',
}

export default function Article() {
  return (
    <>
      <h2>Where to find it</h2>
      <ul>
        <li><code>/timesheet/reports</code> — three views: <strong>By project</strong>, <strong>By employee</strong>, <strong>By activity</strong>.</li>
        <li><code>/timesheet/daily-grid</code> — per-employee × per-day grid of working hours, with leave / WFH cells highlighted.</li>
        <li><code>/timesheet/reconciliation</code> — leave applications vs leave-coded timesheet entries, surfaced as a per-employee mismatch list.</li>
      </ul>
      <p>All three screens are accessible to <code>admin</code>, <code>hr</code>, and <code>payroll</code>.</p>

      <h2>Reports — three lenses</h2>
      <ul>
        <li>
          <strong>By project</strong> — total hours per project, with employee count. Useful for client billing
          and project utilisation.
        </li>
        <li>
          <strong>By employee</strong> — total hours, utilisation %, days logged, days with gaps. Capacity is
          weekdays in range × 8h. Project holidays aren&apos;t subtracted yet (on the backlog).
        </li>
        <li>
          <strong>By activity</strong> — hours per activity type (DEV, REVIEW, MEET, etc.) with share% and
          per-activity employee/project counts.
        </li>
      </ul>

      <h2>Approved-only vs Live</h2>
      <p>
        By default, reports include <strong>only approved weeks</strong> — submitted/draft entries are
        excluded so the numbers match payroll-grade reality. Tick <em>&quot;Include drafts &amp; submitted&quot;</em>
        to see live data (everything employees have logged, regardless of approval state). Useful mid-month
        to spot people who haven&apos;t logged anything yet.
      </p>

      <h2>CSV export</h2>
      <p>
        Each tab has a <strong>Download CSV</strong> button. The export honours your current filter (range +
        live toggle) and uses the current tab as the layout.
      </p>

      <h2>Daily timesheet grid</h2>
      <p>
        <code>/timesheet/daily-grid</code> renders one row per active employee and one column per date in
        the window. Each cell shows the working hours logged that day, in <code>H:MM</code> format. The
        right-hand columns total <strong>Total Working Hours</strong> and <strong>Total Leave Hours</strong> per
        employee.
      </p>

      <h3>This report is timesheet-only</h3>
      <p>
        Every value comes <strong>only from <code>timesheet_entries</code></strong>. The grid does not look at
        leave applications or the monthly plan — it reflects exactly what the employee logged. For each
        (employee, date), entries are split into two buckets by activity code:
      </p>
      <ul>
        <li><strong>Leave hours</strong> — entries under <code>SL</code>, <code>PL</code>, <code>EL</code>, <code>COMP_OFF</code>, <code>LOP</code>.</li>
        <li><strong>Working hours</strong> — every other activity. The entry&apos;s <code>work_mode</code> (WFH or WFO) drives the WFH highlight.</li>
      </ul>
      <p>The cell state is derived from those two numbers:</p>
      <table>
        <thead><tr><th>Cell</th><th>Trigger</th></tr></thead>
        <tbody>
          <tr>
            <td><span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-900">Leave</span></td>
            <td>Leave hours &gt; 0 and worked hours = 0. The dominant leave code (<code>SL</code> / <code>PL</code> / etc.) is shown beneath.</td>
          </tr>
          <tr>
            <td><span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">4:00</span></td>
            <td>Both leave hours and worked hours are present — half-day case. The cell shows the worked hours; the leave portion is summed into the totals column.</td>
          </tr>
          <tr>
            <td><span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-900">8:18 <span className="text-[9px] opacity-70">WFH</span></span></td>
            <td>At least half the worked hours that day were logged with <code>work_mode = WFH</code>. Cell shows worked hours plus a <em>WFH</em> tag.</td>
          </tr>
          <tr>
            <td><span className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-400 italic">0:00</span></td>
            <td>Weekend (Sat / Sun) with no entries.</td>
          </tr>
          <tr>
            <td><code>8:18</code></td>
            <td>Plain working day (mostly WFO) with logged hours.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Because the report is purely timesheet-derived, it can disagree with leave applications. To
        cross-check leave applications against timesheet entries, use the
        <strong> Timesheet × Leave reconciliation</strong> report below.
      </p>
      <p>
        The toolbar has a <em>&quot;Include drafts &amp; submitted&quot;</em> toggle. When unchecked (default), only
        approved weeks contribute. Tick it to include in-flight weeks (drafts and submitted-but-not-yet-approved).
      </p>
      <p>
        Range cap: the grid is capped at <strong>92 days</strong> on screen to keep the table readable. The
        CSV export goes up to a year, so use that for longer windows.
      </p>

      <h2>Excel export — daily grid</h2>
      <p>
        <strong>Download Excel</strong> on the daily-grid page produces an <code>.xlsx</code> file that
        mirrors the on-screen view, including the colour highlighting:
      </p>
      <ul>
        <li><strong>Full-day leave</strong> → cell shows <code>Leave (SL)</code> in bold on a rose fill.</li>
        <li><strong>Half-day leave</strong> → cell shows the worked hours (<code>H:MM</code>) on an amber fill.</li>
        <li><strong>WFH</strong> → cell shows <code>H:MM (WFH)</code> on a sky-blue fill.</li>
        <li><strong>Weekend</strong> → cell shown in light italics on a slate fill.</li>
        <li><strong>Header row</strong> bold on a slate fill; <strong>Total Working Hours</strong> / <strong>Total Leave Hours</strong> bold.</li>
      </ul>
      <p>
        The first two columns (Aalam ID, Employee Name) and the header row stay frozen as you scroll
        horizontally / vertically. Range cap for the Excel export is 366 days.
      </p>

      <h2>Reconciliation report</h2>
      <p>
        <code>/timesheet/reconciliation</code> compares <strong>leave applications</strong> with the
        <strong> leave-coded entries</strong> on the timesheet. It catches three kinds of disagreement:
      </p>
      <table>
        <thead>
          <tr><th>Kind</th><th>What it means</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Leave only — no timesheet</span></td>
            <td>The employee submitted/has-approved leave for a date but didn&apos;t mark a leave entry on their timesheet.</td>
          </tr>
          <tr>
            <td><span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">Timesheet only — no leave</span></td>
            <td>Timesheet has a leave-activity row (SL/PL/EL/COMP_OFF/LOP) for a date, but no leave application backs it.</td>
          </tr>
          <tr>
            <td><span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">Type mismatch</span></td>
            <td>Both exist, but the leave-type code on the application doesn&apos;t match the timesheet activity (e.g. SL applied, EL logged).</td>
          </tr>
        </tbody>
      </table>

      <h2>Submitted + approved are both checked</h2>
      <p>
        Reconciliation runs against leave applications in <code>submitted</code> <em>or</em> <code>approved</code>
        status. That way, mismatches show up as soon as the employee files the application — HR doesn&apos;t have
        to wait for approval to spot a missing timesheet entry. Rejected and cancelled applications are
        ignored. Each row shows a small <em>submitted</em> / <em>approved</em> chip so you can see which ones
        are still pending HR review.
      </p>

      <h2>Per-employee layout</h2>
      <p>
        Mismatches are grouped <strong>one Card per employee</strong>, each header showing chips for
        leave-no-ts / ts-no-leave / mismatch counts. The employee name links to their profile so you can
        jump straight to their timesheet/leave to fix it. Use the employee filter in the toolbar to drill
        into a single person.
      </p>

      <h2>Reconciled cleanly</h2>
      <p>
        Below the mismatch list, a green <strong>&quot;Reconciled cleanly&quot;</strong> Card lists every
        employee whose leave applications and timesheet entries <em>agreed perfectly</em> in the window —
        with a chip showing how many matched days each contributed. The header stat <em>&quot;Reconciled
        cleanly&quot;</em> shows the total matched days across the org so you can see the positive side of
        the picture, not just the issues. An employee only counts as clean if they had at least one leave
        event in the window and zero issues.
      </p>

      <h2>Activity codes treated as leave</h2>
      <p>
        Only entries with these activity codes participate in the reconciliation:
        <code> SL</code>, <code>PL</code>, <code>EL</code>, <code>COMP_OFF</code>, <code>LOP</code>. Other activities
        (DEV, MEET, REVIEW, etc.) are ignored — they&apos;re work, not leave.
      </p>

      <h2>CSV export</h2>
      <p>
        The reconciliation page has its own CSV export. Columns include date, employee code/name, kind of
        issue, leave type + leave status (submitted/approved), timesheet activity + hours, and a
        human-readable detail line per row.
      </p>

      <div className="callout callout-info">
        <strong>Tip:</strong> Reconcile early in the cycle. If an employee has a pending leave that&apos;s
        missing from their timesheet, fixing it before approval keeps reports clean for payroll.
      </div>
    </>
  )
}
