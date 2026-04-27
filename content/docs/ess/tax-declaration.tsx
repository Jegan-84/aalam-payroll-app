import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'tax-declaration',
  title: 'Tax Declaration',
  summary: 'Declare investments, rent, and home-loan interest so the right TDS is cut every month.',
  group: 'Pay',
}

export default function Article() {
  return (
    <>
      <h2>Why declare?</h2>
      <p>
        Your TDS is computed on your projected annual taxable income. If you don&apos;t declare your
        80C investments, HRA, etc., the system has to assume zero — which means more tax is cut every
        month than necessary. Declaring early gets you correct take-home, every month.
      </p>

      <h2>When to declare</h2>
      <p>
        The window is <strong>April through January</strong> of the financial year. Submit your initial
        declaration in April or as soon as you join. You can revise it any time within the window.
      </p>
      <div className="callout callout-warn">
        <strong>February cut-off:</strong> declarations get locked in February. After that, the proofs
        you submit only matter for Form 16 reconciliation; the monthly TDS for Feb / Mar uses whatever
        was on file at lock time.
      </div>

      <h2>What to declare</h2>
      <h3>Old regime (most common deductions)</h3>
      <ul>
        <li><strong>80C</strong> — PPF, ELSS, life insurance premium, principal of home loan, kids&apos; tuition. ₹1.5L cap.</li>
        <li><strong>80D</strong> — health insurance premium for self, spouse, kids, parents.</li>
        <li><strong>80CCD(1B)</strong> — additional ₹50K for NPS contributions.</li>
        <li><strong>HRA</strong> — monthly rent, landlord PAN if rent &gt; ₹1L/year.</li>
        <li><strong>Section 24</strong> — home loan interest, up to ₹2L for self-occupied.</li>
        <li><strong>Section 80E</strong> — education loan interest.</li>
      </ul>
      <h3>New regime</h3>
      <p>
        Most of the above deductions are <em>not</em> available under the new regime. Standard deduction
        of ₹75K is applied automatically. The only thing worth declaring is your regime choice itself
        and any employer-NPS (80CCD(2)).
      </p>

      <h2>Choosing a regime</h2>
      <p>
        Pick once at the start of the FY. The system honours your selection on every payslip. If you&apos;re
        unsure, the new regime tends to win unless you have substantial 80C / HRA / home loan benefits.
      </p>

      <h2>Submitting proofs</h2>
      <p>
        Declarations are estimates. In Jan/Feb you&apos;ll be asked to upload <strong>proofs</strong>
        (rent receipts, premium receipts, etc.). What can&apos;t be proven gets reversed at year-end.
      </p>
    </>
  )
}
