import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'prior-earnings',
  title: 'Form 12B — previous employer salary',
  summary: "If you joined Aalam mid-year, declare what your previous employer paid + already deducted as TDS so we don't over-cut tax this year.",
  group: 'Pay',
}

export default function Article() {
  return (
    <>
      <h2>Who needs to fill this?</h2>
      <p>
        Anyone who <strong>worked for another employer earlier this financial year</strong> (April → March)
        before joining Aalam. If Aalam is your first job this FY, skip — there&apos;s nothing to declare.
      </p>
      <p>
        Without 12B, our TDS engine assumes you&apos;ve earned zero before joining and projects your full annual income from your Aalam salary alone.
        That can make your monthly TDS swing in either direction — too high if you weren&apos;t taxable before
        (over-deducted, you&apos;d claim refund next July) or too low if you were already in a lower bracket
        (under-deducted, you owe IT a balloon payment).
      </p>

      <h2>Where to enter it</h2>
      <ol>
        <li>Open <code>/me/declaration</code> (the Tax Declaration page).</li>
        <li>Scroll to <strong>&quot;Previous employer (Form 12B)&quot;</strong> at the bottom.</li>
        <li>Click <em>Add 12B details</em>. The form expands.</li>
      </ol>

      <h2>What to fill</h2>
      <p>You only need <strong>two required fields</strong>; everything else is optional and helps with Form 16 reconciliation:</p>

      <h3>Required</h3>
      <ul>
        <li><strong>Gross salary</strong> — total amount you actually received from the previous employer this FY (April through your last day there).</li>
        <li><strong>TDS deducted</strong> — total income tax already deducted by the previous employer this FY.</li>
      </ul>

      <h3>Recommended</h3>
      <ul>
        <li><strong>PF deducted</strong> — relevant for the 80C cap calculation under the old regime.</li>
        <li><strong>Professional tax</strong> — a deduction under both regimes.</li>
      </ul>

      <h3>Optional (for Form 16 reference)</h3>
      <ul>
        <li>Salary breakdown — Basic, HRA, Conveyance, Perquisites.</li>
        <li>Previous employer name, PAN, TAN.</li>
        <li>Which regime you were under at the previous employer.</li>
      </ul>

      <div className="callout callout-info">
        <strong>Where to find these numbers:</strong> your last payslip from the previous employer, or
        the Form 16 (or interim 12BA / 16A statements) they should issue when you exit.
      </div>

      <h2>Does the regime matter?</h2>
      <p>
        Not for the 12B itself. Under <strong>Section 192(2)</strong> the new employer combines your
        previous gross with your Aalam projection and recomputes total annual tax under <em>your current
        regime</em> (whichever you picked here). Whatever the previous employer allowed (HRA, 80C, etc.)
        doesn&apos;t carry over. Only two things flow through to TDS:
      </p>
      <ul>
        <li>Previous <strong>gross</strong> → added to the annual taxable base.</li>
        <li>Previous <strong>TDS</strong> → subtracted from total tax owed for the year.</li>
      </ul>

      <h2>What happens after you save?</h2>
      <ol>
        <li>HR sees your 12B in their declaration review screen and verifies it. After verification, the form locks — ask HR if you need a change.</li>
        <li>The next payroll cycle&apos;s TDS reflects the combined annual picture. Your remaining months will deduct exactly the tax left to pay, spread evenly.</li>
        <li>Form 16 in March will show a separate annexure for previous-employer salary alongside Aalam&apos;s.</li>
      </ol>

      <h2>Worked examples</h2>

      <h3>Below taxable previously, taxable now</h3>
      <p>
        You earned ₹2.5L April–September at the old company (no TDS). Joined Aalam Oct 1 at ₹70,000/month
        (₹4.2L for Oct–Mar). Total annual = ₹6.7L. With 12B saved, TDS is computed on ₹6.7L − ₹0 prev TDS,
        spread over your remaining payslips. Without 12B, we&apos;d project ₹4.2L × 12/6 = ₹8.4L and cut more
        than needed.
      </p>

      <h3>Already taxed, joining at higher salary</h3>
      <p>
        You earned ₹6L at the old company April–September with ₹50,000 already deducted as TDS. Joined Aalam
        Oct 1 at ₹1.5L/month. Total annual ≈ ₹15L → roughly ₹2L tax under new regime. With 12B: ₹2L − ₹50k
        already paid = ₹1.5L spread over 6 months. Without 12B, we&apos;d project ₹18L and over-cut.
      </p>

      <h2>Common questions</h2>

      <h3>I worked at two previous employers this FY — do I file two 12Bs?</h3>
      <p>
        Add the figures together into one consolidated 12B for Aalam. (12B is per-employee-per-FY.) Note in
        the &quot;Notes&quot; field that this aggregates two prior employers, and keep both Form 16 / payslips
        for your tax filing.
      </p>

      <h3>I don&apos;t have my previous Form 16 yet — can I estimate?</h3>
      <p>
        Yes — use the most recent payslip from the previous employer (it usually shows YTD gross + YTD TDS).
        You can update the figures once Form 16 arrives, as long as HR hasn&apos;t verified yet.
      </p>

      <h3>What if I forget?</h3>
      <p>
        Your Aalam TDS will be incorrect (usually too high). You&apos;ll need to claim a refund or pay a
        balance when you file ITR in July. It&apos;s better — and legally cleaner under Section 192(2) — to
        declare here.
      </p>
    </>
  )
}
