import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'employees',
  title: 'Employees — onboarding, conversion, exit',
  summary: 'How to add a new employee, change their employment type mid-year, and run F&F at exit.',
  group: 'People',
}

export default function Article() {
  return (
    <>
      <h2>Onboarding a new employee</h2>
      <ol>
        <li>Go to <code>/employees</code> → <strong>+ New employee</strong>.</li>
        <li>Fill in Identity / Personal / Address / Statutory IDs.</li>
        <li>Set <strong>Employment</strong>: company, department, designation, location, <strong>primary project</strong> (drives the holiday calendar), employment type, DOJ.</li>
        <li>Add bank details and pick a tax regime (NEW / OLD).</li>
        <li>Toggle Lunch / Shift allowance applicable if relevant.</li>
        <li>Save. The employee record is created.</li>
      </ol>

      <h2>After save</h2>
      <ol>
        <li>Build the salary structure: <code>/employees/[id]/salary</code>. Enter the monthly gross; the system splits it into BASIC / HRA / Conveyance / Special based on statutory config.</li>
        <li>Add recurring components if any (custom earnings/deductions).</li>
        <li>Upload POI documents.</li>
        <li><strong>Allocate leave</strong>: go to <code>/leave/balances</code>, switch to the &quot;New joiner&quot; tab, pick the employee, click Allocate. The annual quotas get prorated by months remaining from DOJ.</li>
      </ol>

      <div className="callout callout-tip">
        <strong>Why use the New-joiner tab?</strong> If you click the global &quot;Seed FY&quot; button, the
        new employee gets the <em>full</em> annual quota — too generous for a mid-year hire. The
        joiner tab prorates correctly.
      </div>

      <h2>Changing employment type mid-year</h2>
      <p>
        Use the <strong>Convert employment type</strong> button on the employee&apos;s detail page.
        The dialog asks for the new type, an effective date, and a reason. It then:
      </p>
      <ol>
        <li>Updates <code>employment_type</code>.</li>
        <li>Appends an <code>employee_employment_history</code> row stamped with the effective date.</li>
        <li>Diffs eligibility — for <em>newly-eligible</em> leave types, inserts prorated balance rows from the effective date.</li>
        <li>For <em>no-longer-eligible</em> types, balances are <strong>kept</strong>. Use the Adjust dialog on /leave/balances if you want to claw them back.</li>
      </ol>
      <p>
        The dialog shows a summary after save: which types were granted (with days) and which lost
        eligibility but kept their balance.
      </p>

      <h3>Examples</h3>
      <ul>
        <li><strong>Intern → Probation on July 1</strong>: PL becomes eligible. 6 days credited (12 × 6/12).</li>
        <li><strong>Probation → Full-time on Oct 1</strong>: EL becomes eligible. 1.5 days credited (6 × 3/12, rounded to 0.5).</li>
        <li><strong>Full-time → Contract</strong>: same eligibility set in the default policy. No leave changes.</li>
      </ul>

      <h2>Exit / F&amp;F</h2>
      <ol>
        <li>Update employment status to <code>resigned</code>, set <code>date_of_exit</code>.</li>
        <li>Open <code>/employees/[id]/fnf</code> → compute settlement.</li>
        <li>F&amp;F adds: pro-rata salary to last working day, encashed unused EL (if encashable_on_exit), gratuity if eligible. Subtracts: outstanding loan principal, any advances.</li>
        <li>Approve. The settlement flows into the next payroll cycle as a one-off.</li>
      </ol>

      <h2>Profile changes</h2>
      <p>
        Department / designation / location / reports-to changes also trigger an
        <code>employee_employment_history</code> row, but they don&apos;t touch leave eligibility.
        Use the convert dialog only when <em>employment_type</em> is changing.
      </p>
    </>
  )
}
