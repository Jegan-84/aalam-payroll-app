import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'reimbursements',
  title: 'Reimbursements & Loans',
  summary: 'Submitting bills for reimbursement and reading your loan schedule.',
  group: 'Pay',
}

export default function Article() {
  return (
    <>
      <h2>Reimbursements</h2>
      <p>
        Eligible expenses (travel, internet, mobile, books — depends on your role) can be claimed
        through <code>/me/reimbursements</code>. HR approves and the amount flows into your next
        payslip as a non-taxable earning, where applicable.
      </p>

      <h3>How to submit</h3>
      <ol>
        <li>Click <strong>+ Submit claim</strong>.</li>
        <li>Pick the category (Travel / Internet / Mobile / etc.) and the expense date.</li>
        <li>Upload the bill (PDF or image).</li>
        <li>Add the amount and a one-line description.</li>
      </ol>

      <h3>Status flow</h3>
      <ul>
        <li><code>submitted</code> — sitting with HR.</li>
        <li><code>approved</code> — will be added to the next payroll cycle as a <code>REIMB_*</code> earning line.</li>
        <li><code>paid</code> — included in a cycle that&apos;s been approved. You&apos;ll see it on the payslip.</li>
        <li><code>rejected</code> — declined. Notes explain why; you can resubmit a corrected claim.</li>
      </ul>

      <div className="callout callout-info">
        Tax handling: most categories are non-taxable up to a cap (e.g., ₹3,000/month internet). Anything above the cap is added to taxable income.
      </div>

      <h2>Loans</h2>
      <p>
        If you took a company loan or salary advance, <code>/me/loans</code> shows it.
        For each loan you&apos;ll see:
      </p>
      <ul>
        <li><strong>Principal</strong> — the original amount.</li>
        <li><strong>Outstanding</strong> — what&apos;s left after EMIs paid so far.</li>
        <li><strong>EMI schedule</strong> — month-by-month, with paid / pending status.</li>
        <li><strong>Perquisite</strong> — if interest is concessional, the perquisite value gets added to your taxable income (auto-computed each month).</li>
      </ul>

      <h3>Foreclosing a loan</h3>
      <p>
        If you want to clear an outstanding loan early — e.g., before resigning — request a foreclosure
        through HR. They&apos;ll compute the closing balance (principal + accrued interest) and recover it
        from your final payslip or a one-off recovery.
      </p>
    </>
  )
}
