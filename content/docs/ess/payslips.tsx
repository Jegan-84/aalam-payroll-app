import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'payslips',
  title: 'Payslips',
  summary: 'Where to find your payslips, how earnings/deductions are computed, and what TDS depends on.',
  group: 'Pay',
}

export default function Article() {
  return (
    <>
      <h2>Where to find them</h2>
      <p>
        <code>/me/payslips</code> lists every payroll cycle that included you. Click any cycle to view
        and download the PDF. Older cycles live forever — you can pull a 2-year-old payslip the same way
        as the current month.
      </p>

      <h2>What&apos;s on a payslip</h2>
      <p>Each payslip has three sections:</p>
      <ul>
        <li><strong>Earnings</strong> — BASIC, HRA, Conveyance, Special Allowance, plus any custom
            components your role gets (lunch, shift allowance, reimbursements, leave encashment).</li>
        <li><strong>Deductions</strong> — PF, ESI (if eligible), Professional Tax (state-wise),
            TDS (income tax), loan EMIs.</li>
        <li><strong>Net pay</strong> = Gross earnings − Total deductions. This is what hits your bank.</li>
      </ul>

      <h2>How TDS is computed</h2>
      <p>
        TDS depends on your tax regime (NEW or OLD), declared investments (under Tax Declaration), and
        your annual projected earnings. Each month deducts roughly 1/12 of your projected annual tax,
        with adjustments for changes mid-year.
      </p>
      <div className="callout callout-info">
        <strong>If you submit declarations late:</strong> we don&apos;t retro-correct earlier months —
        we average the catch-up across the remaining months of the FY, so the deduction looks higher
        for those months. The <em>annual</em> total is correct.
      </div>

      <h2>Variable pay months</h2>
      <p>
        If your role has Variable Pay, it&apos;s usually paid once a year (often April or June payslip).
        The TDS for that month spikes proportionally — VP is lump-sum income.
      </p>

      <h2>Loan EMIs</h2>
      <p>
        If you have an active company loan, the EMI is deducted automatically. The <code>/me/loans</code>
        page shows the schedule, what&apos;s been paid, and the outstanding principal.
      </p>

      <h2>If a payslip is wrong</h2>
      <p>
        Don&apos;t mass-email — raise it once with payroll. They can re-open the cycle and recompute,
        or post a correction in the next cycle, depending on what changed.
      </p>
    </>
  )
}
