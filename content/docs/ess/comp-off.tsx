import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'comp-off',
  title: 'Comp Off',
  summary: 'When to request comp off, how the 30-day expiry works, and how to use the granted day.',
  group: 'Time off',
}

export default function Article() {
  return (
    <>
      <h2>What is Comp Off?</h2>
      <p>
        Compensatory off (Comp Off) is what you earn when you work on a holiday or weekend at the
        company&apos;s request. It&apos;s a <strong>1-for-1</strong> trade — one day worked = one day off, with HR approval.
      </p>

      <h2>How to request it</h2>
      <ol>
        <li>Go to <code>/me/comp-off</code>.</li>
        <li>Pick the <strong>work date</strong> — the actual day you worked (must be a past date).</li>
        <li>Pick days (0.5, 1, or 2) and a reason.</li>
        <li>Submit. Status starts as <code>submitted</code>.</li>
      </ol>

      <h2>The 30-day clock</h2>
      <div className="callout callout-warn">
        Once HR approves, the comp off <strong>expires 30 days from the work date</strong> — not from the
        approval date. So if you worked on March 1 and HR approves on March 15, you still have until
        March 31 to use it.
      </div>
      <p>
        This means: request comp off promptly, and don&apos;t wait until the last week to apply leave against
        it. If a request gets approved very late — say 35 days after the work date — it&apos;s already past
        expiry and won&apos;t add to your balance.
      </p>

      <h2>Using the comp off</h2>
      <p>
        Once approved, your comp off shows up under &quot;My active grants&quot; on <code>/me/comp-off</code>
        and as a <code>COMP_OFF</code> balance on <code>/me/leave</code>. To use it, apply for leave with
        type <code>COMP_OFF</code>. The day will be deducted just like any other leave.
      </p>

      <h2>Statuses</h2>
      <table>
        <thead><tr><th>Status</th><th>What it means</th></tr></thead>
        <tbody>
          <tr><td><code>submitted</code></td><td>Pending HR approval.</td></tr>
          <tr><td><code>approved</code></td><td>HR approved; a comp off grant is in your balance with a 30-day window.</td></tr>
          <tr><td><code>rejected</code></td><td>HR declined. The note tells you why.</td></tr>
          <tr><td><code>cancelled</code></td><td>You cancelled it before it was decided.</td></tr>
        </tbody>
      </table>

      <h2>Grant statuses</h2>
      <p>The active grants table shows what happened to each approved day:</p>
      <ul>
        <li><code>active</code> — usable.</li>
        <li><code>used</code> — claimed via a leave application.</li>
        <li><code>expired</code> — past the 30-day window without being used.</li>
        <li><code>revoked</code> — HR cancelled the grant.</li>
      </ul>
    </>
  )
}
