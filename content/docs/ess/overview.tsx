import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'overview',
  title: 'Welcome to PayFlow',
  summary: 'A 60-second tour of the employee portal — what you can do here, and where to find it.',
  group: 'Getting started',
}

export default function Article() {
  return (
    <>
      <h2>What is PayFlow?</h2>
      <p>
        PayFlow is Aalam&apos;s in-house payroll system. The pages you see at <code>/me/*</code> are
        the <em>Employee Self-Service</em> portal. From here you handle anything to do with your
        own pay, leave, and tax — without emailing HR.
      </p>

      <h2>What you can do</h2>
      <ul>
        <li><strong>Payslips</strong> — download every month&apos;s payslip as PDF.</li>
        <li><strong>Leave</strong> — see your balances, apply for leave, track approvals.</li>
        <li><strong>Comp Off</strong> — request comp off for a holiday/weekend you worked, with HR approval.</li>
        <li><strong>Holidays</strong> — see the holiday calendar that applies to your project.</li>
        <li><strong>Tax Declaration</strong> — declare your investments and rent so the right TDS gets cut every month.</li>
        <li><strong>Reimbursements</strong> — submit bills (travel, internet, etc.) for HR to approve and reimburse via payroll.</li>
        <li><strong>Loans</strong> — view active loans, EMI schedule, and outstanding principal.</li>
        <li><strong>Profile</strong> — bank details, PAN, address, emergency contact.</li>
      </ul>

      <h2>How approvals work</h2>
      <p>
        Anything you submit (leave, comp off, reimbursement) goes to HR/admin for review. You&apos;ll see
        the status in your list — <code>submitted</code>, <code>approved</code>, <code>rejected</code>, or
        <code> cancelled</code>. Approved items flow into your next payslip automatically.
      </p>

      <div className="callout callout-info">
        <strong>Tip:</strong> Most actions update right away. If something looks stale, refresh the page —
        we don&apos;t cache aggressively, but a refresh always shows the latest server state.
      </div>

      <h2>Who to ask</h2>
      <ul>
        <li><strong>Wrong leave balance, wrong TDS, missing payslip</strong> — HR (raise it; they have an Adjust tool).</li>
        <li><strong>Bank or PAN change</strong> — update under Profile, then ping HR to verify.</li>
        <li><strong>App bug</strong> — Aalam IT.</li>
      </ul>
    </>
  )
}
