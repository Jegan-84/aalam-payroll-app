import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'leave',
  title: 'Leave',
  summary: 'How to read your balance, apply for leave, and what the leave types mean.',
  group: 'Time off',
}

export default function Article() {
  return (
    <>
      <h2>Leave year</h2>
      <p>
        PayFlow runs on a <strong>calendar leave year</strong> — Jan 1 to Dec 31.
        This is independent of the payroll FY (Apr–Mar) used for tax. Balances reset each January.
      </p>

      <h2>The numbers on /me/leave</h2>
      <p>For each leave type you&apos;ll see seven fields. Here&apos;s what they mean.</p>
      <table>
        <thead>
          <tr><th>Column</th><th>What it means</th></tr>
        </thead>
        <tbody>
          <tr><td><code>Opening</code></td><td>Days you start the year with (carry-over from last year + any upfront grant).</td></tr>
          <tr><td><code>Accrued</code></td><td>Days credited so far through the year (half-yearly for PL/SL, monthly for others).</td></tr>
          <tr><td><code>Carried fwd</code></td><td>Unused days carried in from last year, capped per policy.</td></tr>
          <tr><td><code>Used</code></td><td>Days consumed by approved leaves so far.</td></tr>
          <tr><td><code>Encashed</code></td><td>Days converted to cash (year-end PL encashment, F&amp;F EL encashment).</td></tr>
          <tr><td><code>Balance</code></td><td>Opening + Accrued + Carried fwd − Used − Encashed + any Adjustment.</td></tr>
        </tbody>
      </table>

      <h2>Leave types</h2>
      <ul>
        <li><strong>PL (Paid Leave)</strong> — 12 days/year, credited 6 in January and 6 in July. Unused 6 from H1 carry into H2.</li>
        <li><strong>SL (Sick Leave)</strong> — 12 days/year, same half-yearly cadence.</li>
        <li><strong>EL (Earned Leave)</strong> — 6 days/year, credited annually upfront. Carries forward up to 6.</li>
        <li><strong>COMP_OFF</strong> — granted by HR after you raise a Comp Off request (see the Comp Off article).</li>
        <li><strong>LOP (Loss of Pay)</strong> — unpaid leave. Used when you have no balance left.</li>
      </ul>
      <p>
        Some leave types only apply to certain employment types. Interns get only SL, COMP_OFF, LOP.
        Probation adds PL. Permanent / contract / consultant get all five plus EL.
      </p>

      <h2>How to apply</h2>
      <ol>
        <li>Click <strong>+ Apply for leave</strong> at the top of <code>/me/leave</code>.</li>
        <li>Pick the leave type, from / to dates, and add a short reason.</li>
        <li>The form computes your day count automatically (skipping weekly offs and holidays for your project).</li>
        <li>Submit. The application appears in &quot;My applications&quot; with status <code>submitted</code>.</li>
      </ol>

      <div className="callout callout-warn">
        <strong>Watch out:</strong> If your range covers project holidays or weekends, those days don&apos;t
        count against your balance — but the <em>day count</em> shown is what gets deducted on approval.
      </div>

      <h2>What happens after submit</h2>
      <ol>
        <li>HR sees your request in their pending queue.</li>
        <li>If approved, your <code>Used</code> goes up, your balance drops, and your attendance is marked LEAVE.</li>
        <li>If rejected, the status changes to <code>rejected</code> with a reason.</li>
        <li>You can <strong>cancel</strong> a request as long as it&apos;s still <code>submitted</code>.</li>
      </ol>

      <h2>Year-end behaviour (Dec 31)</h2>
      <p>
        Once a year, HR runs the year-end conversion. If you have unused PL and your EL is empty,
        up to 6 PL days move into EL. Anything left over is <strong>encashed</strong> at (BASIC ÷ 30)
        per day and shows up as a <code>LEAVE_ENC</code> earning on January&apos;s payslip.
      </p>
    </>
  )
}
