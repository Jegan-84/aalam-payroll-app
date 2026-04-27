import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'comp-off',
  title: 'Comp Off — approvals & expiry',
  summary: 'How to approve / reject employee comp off requests and how the 30-day expiry works.',
  group: 'Leave',
}

export default function Article() {
  return (
    <>
      <h2>Where</h2>
      <p>
        <code>/comp-off</code> lists all employee-submitted comp off requests. Pending requests sit in
        the top queue with Approve / Reject buttons. Recent decisions show below.
      </p>

      <h2>Approving</h2>
      <p>Click <strong>Approve</strong>. The action:</p>
      <ol>
        <li>Creates a <code>comp_off_grants</code> row anchored on the request&apos;s <code>work_date</code>.</li>
        <li>Sets <code>expires_on = work_date + 30 days</code> — <em>not</em> approval-date + 30 days.</li>
        <li>Recomputes the employee&apos;s <code>COMP_OFF</code> leave balance.</li>
        <li>Notifies the employee.</li>
      </ol>
      <div className="callout callout-warn">
        <strong>Late approval doesn&apos;t buy more time.</strong> If you approve a comp off 35 days after
        the work date, expiry is already past and the employee won&apos;t see balance added. Approve
        promptly.
      </div>

      <h2>Rejecting</h2>
      <p>
        Add a note (visible to the employee), then click <strong>Reject</strong>. The request status
        flips to <code>rejected</code>. No grant is created.
      </p>

      <h2>Direct grants (HR backfill)</h2>
      <p>
        If an employee is owed a comp off but didn&apos;t raise a request (or the work date is from before
        the request flow existed), use the <strong>Comp Off</strong> card on <code>/leave/balances</code>
        to grant directly. The form takes employee, work date, days, expiry-days override.
      </p>

      <h2>Expiry sweep</h2>
      <p>
        At the bottom of the comp-off card on /leave/balances there&apos;s a <strong>Run expiry sweep</strong>
        button. It walks all active grants and flips anything past <code>expires_on</code> to
        <code> expired</code>, then recomputes balances for affected employees. Idempotent — safe to
        run weekly. (Or wire it as a cron in production.)
      </p>

      <h2>Revoking</h2>
      <p>
        If a grant was approved by mistake, you can revoke an <em>unused</em> grant from the comp-off
        ledger (currently via SQL or by extending the UI; the action <code>revokeCompOffAction</code>
        exists). Used grants can&apos;t be revoked — claw back via the leave-balance Adjust dialog instead.
      </p>
    </>
  )
}
