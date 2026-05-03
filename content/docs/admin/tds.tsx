import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'tds',
  title: 'TDS, challans & Form 16',
  summary: 'Monthly TDS computation, quarterly 24Q, annual Form 16. The compliance loop.',
  group: 'Payroll',
}

export default function Article() {
  return (
    <>
      <h2>How monthly TDS is computed</h2>
      <ol>
        <li>Project annual taxable income from current cycle&apos;s gross + remaining-month projections.</li>
        <li>Apply employee&apos;s declared deductions (NEW or OLD regime).</li>
        <li>Compute annual tax per the chosen regime&apos;s slabs (loaded from <code>/settings/tax</code>).</li>
        <li>Subtract TDS already deducted in earlier months of this FY.</li>
        <li>Spread the remaining tax across remaining months. The current cycle gets one slice.</li>
      </ol>
      <p>
        Result: a steady monthly TDS that auto-corrects when declarations change mid-year, and a
        large catch-up if the employee declares late. The <em>annual</em> total is always correct.
      </p>

      <h2>TDS challans</h2>
      <p>
        After every payroll cycle is approved, sum-of-TDS for the month is one entry on
        <code>/tds/challans</code>. Click <strong>+ New challan</strong> to record what you paid on
        TRACES (BSR code, challan number, date). The system uses these to populate Form 24Q.
      </p>

      <h2>Quarterly Form 24Q</h2>
      <p>
        File at the end of every quarter (Q1 = Apr–Jun due Jul 31; Q2 = Jul–Sep due Oct 31;
        Q3 = Oct–Dec due Jan 31; Q4 = Jan–Mar due May 31).
      </p>
      <ol>
        <li>Go to <code>/tds/24q</code>.</li>
        <li>Pick FY + quarter. Verify the totals match what you remitted via challans.</li>
        <li>Generate the file. Upload it on the TRACES portal.</li>
      </ol>

      <h2>Annual Form 16</h2>
      <p>
        After Q4 24Q is filed and the deductor portal returns Part A, generate Form 16:
      </p>
      <ol>
        <li><code>/tds</code> → Form 16 → pick FY → generate.</li>
        <li>Each employee gets a PDF combining Part A (from TRACES) + Part B (gross / deductions / tax computed by PeopleStack).</li>
        <li>Distribution: PDF lands on <code>/me/payslips</code> for the employee. Email-out is manual today.</li>
      </ol>

      <h2>What can go wrong</h2>
      <ul>
        <li><strong>Mismatch with 26AS</strong> — challan numbers / dates mistyped on entry. Fix by editing the challan row, then re-generate 24Q.</li>
        <li><strong>Late declarations</strong> — Feb / Mar TDS will spike. Communicate this to employees in advance.</li>
        <li><strong>Regime swap mid-year</strong> — the system honours the latest declaration, but spread the catch-up across remaining months. Document rationale on the audit trail.</li>
      </ul>
    </>
  )
}
