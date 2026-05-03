import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'prior-earnings',
  title: 'Form 12B — mid-FY joiner TDS',
  summary: 'Combining prior-employer salary into TDS for joiners under Section 192(2). Workflow + how to verify.',
  group: 'Payroll',
}

export default function Article() {
  return (
    <>
      <h2>What it solves</h2>
      <p>
        For an employee who joined Aalam mid-FY, our TDS engine has only their Aalam salary to project from.
        Either of these scenarios produces the wrong monthly TDS:
      </p>
      <ul>
        <li>
          <strong>Scenario 1 — under-taxed previously.</strong> Joiner earned below the basic exemption with the
          previous employer (no TDS deducted). They join Aalam at a salary that pushes them into the taxable
          range only when annualised. Without 12B, our engine annualises just the Aalam slice, mis-projects, and
          cuts more than necessary.
        </li>
        <li>
          <strong>Scenario 2 — over-taxed projection.</strong> Joiner already paid TDS at the previous employer.
          They join Aalam at a higher salary. If we compute on Aalam pay alone and annualise by months remaining,
          we double-charge or skip what was already paid.
        </li>
      </ul>
      <p>
        <strong>Section 192(2)</strong> of the IT Act requires the new employer to take prior-employer salary +
        TDS into account. Form 12B is the mechanism.
      </p>

      <h2>Where it lives</h2>
      <ul>
        <li><strong>Employee</strong> — fills it under <code>/me/declaration</code>, in the &quot;Previous employer (Form 12B)&quot; section. See the ESS-side article for the user view.</li>
        <li><strong>HR review</strong> — under <code>/employees/[id]/declaration</code>. Two blocks at the bottom:
          <ul>
            <li><em>Summary panel</em> with at-a-glance figures and verify / unverify / clear actions.</li>
            <li><em>Full edit form</em> in admin mode — edit on the employee&apos;s behalf or correct figures even after verification.</li>
          </ul>
        </li>
      </ul>

      <h2>Required fields</h2>
      <table>
        <thead><tr><th>Field</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>gross_salary</code></td><td>Added to the annual taxable base in TDS projection.</td></tr>
          <tr><td><code>tds_deducted</code></td><td>Subtracted from total annual tax to compute remaining tax to deduct here.</td></tr>
          <tr><td><code>pf_deducted</code></td><td>Used in the 80C cap math (old regime only).</td></tr>
          <tr><td><code>professional_tax_deducted</code></td><td>Deductible under both regimes.</td></tr>
        </tbody>
      </table>
      <p>
        Optional fields (basic / HRA / conveyance / perqs / employer name / PAN / TAN / prev-regime / notes)
        don&apos;t feed the TDS math. They&apos;re stored for Form 16 Part B reconciliation and audit.
      </p>

      <div className="callout callout-info">
        <strong>Regime invariant:</strong> the prior employer&apos;s regime choice is informational only. Aalam&apos;s
        TDS engine always recomputes the combined annual tax under the employee&apos;s <em>current</em> regime +
        their <em>current</em> declarations. The new employer doesn&apos;t inherit prior HRA / 80C deductions —
        those were applied (or not) at the prior employer. Only gross + prior TDS flow through.
      </div>

      <h2>Verification workflow</h2>
      <ol>
        <li>Employee submits 12B from <code>/me/declaration</code>. Status = unverified, but the figures are still readable by the TDS engine (it doesn&apos;t require verification to use them — it&apos;s an honour-based system, audited via Form 16).</li>
        <li>HR reviews against the joiner&apos;s previous Form 16 / last payslip. Common checks:
          <ul>
            <li>Gross matches prior Form 16 Part B &quot;Gross salary&quot; line.</li>
            <li>TDS matches Form 16 / 26AS for the prior employer&apos;s TAN.</li>
            <li>Professional tax + PF look reasonable for the gross.</li>
          </ul>
        </li>
        <li>Click <strong>✓ Verify</strong>. Employee can no longer edit; ask HR to <strong>Unverify</strong> if a correction is needed.</li>
        <li>If filed by mistake (e.g. the joiner was actually fresh out of college), use <strong>Clear</strong> to delete the record.</li>
      </ol>

      <h2>What HR should ask the joiner for</h2>
      <ol>
        <li>Last payslip from the previous employer for the current FY (shows YTD gross + YTD TDS).</li>
        <li>Form 16 for the current FY when issued — used to reconcile against the saved 12B.</li>
        <li>If the joiner had two prior employers this FY, ask them to consolidate into one declaration and note both employer names in the Notes field.</li>
      </ol>

      <h2>Audit trail</h2>
      <ul>
        <li>Every save / verify / unverify / clear logs an entry in <code>audit_log</code> with actor, action, and the (employee, FY) key.</li>
        <li>The summary text records who did what and the rupee figures involved at the time.</li>
      </ul>

      <h2>Form 16 implications (Phase C)</h2>
      <p>
        When fully wired into Form 16 Part B (a follow-up phase), the generated PDF gains a separate annexure
        for &quot;Salary received from previous employer this FY&quot; with the gross + TDS figures from this 12B. The
        total tax payable shown on the form already nets out prior TDS via Section 192(2) maths.
      </p>

      <h2>Edge cases</h2>

      <h3>Joiner says the prior employer&apos;s TDS was cut but Form 16 isn&apos;t out yet</h3>
      <p>
        Accept the last payslip&apos;s YTD figures. Mark verified provisionally with a Notes entry like &quot;Pending
        Form 16 reconciliation&quot;. Re-verify against Form 16 when it lands.
      </p>

      <h3>Joiner had no prior employment this FY</h3>
      <p>
        They simply skip the section. Don&apos;t create a zero-row record on their behalf — leave the table empty.
      </p>

      <h3>Joiner is rehiring after a break, prior employment was last FY</h3>
      <p>
        12B is per-FY. If the prior employment was wholly in the previous FY, no 12B is needed for the current
        FY — that&apos;s already in their previous-year ITR.
      </p>
    </>
  )
}
