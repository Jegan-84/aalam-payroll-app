import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'settings',
  title: 'Settings & masters',
  summary: 'Org masters: companies, departments, designations, projects, locations, statutory, tax slabs, PT, custom pay components, users.',
  group: 'Setup',
}

export default function Article() {
  return (
    <>
      <h2>Order of setup (first-time install)</h2>
      <ol>
        <li><strong>Companies</strong> — legal entities. Each employee is tagged to one. Drives payslip header.</li>
        <li><strong>Locations</strong> — offices / cities. Drives PT slabs and (optionally) location-scoped holidays.</li>
        <li><strong>Departments</strong>, <strong>Designations</strong>, <strong>Projects</strong> — org structure.</li>
        <li><strong>Statutory config</strong> — BASIC / HRA / Conveyance percentages, PF cap, ESI cap, gratuity %. Drives every salary structure.</li>
        <li><strong>Tax slabs</strong> — per FY × NEW / OLD regime. Populate before the first payslip of an FY.</li>
        <li><strong>PT slabs</strong> — half-yearly Professional Tax per state.</li>
        <li><strong>Custom pay components</strong> — earnings / deductions outside the statutory split.</li>
        <li><strong>Leave types &amp; policies</strong> — see the Leave Policies article.</li>
        <li><strong>Holidays</strong> — for the current FY. See the Holidays article.</li>
        <li><strong>Users &amp; roles</strong> — invite admin / hr / payroll users. Employees get auto-created when the employee row links via work_email.</li>
      </ol>

      <h2>Companies</h2>
      <p>
        Each company has code, legal name, display name, address, PAN, TAN, and bank details for
        outbound transfers. Tag every employee to one. The display name and PAN appear on payslips
        and Form 16.
      </p>

      <h2>Statutory config</h2>
      <p>
        Single page that drives every salary structure:
      </p>
      <ul>
        <li>BASIC % of gross (default 50%).</li>
        <li>HRA % of BASIC (default 50% metro / 40% non-metro).</li>
        <li>Conveyance fixed amount or %.</li>
        <li>PF — employer % (default 12%), employee % (default 12%), wage cap (default ₹15,000).</li>
        <li>ESI — applicability cap (default ₹21,000 gross), employer % (3.25%), employee % (0.75%).</li>
        <li>Gratuity — % of BASIC accrued each month (typically 4.81% on the basic).</li>
      </ul>
      <div className="callout callout-warn">
        Changing statutory % mid-year doesn&apos;t retro-correct existing payslips. It applies from the
        next computed cycle onwards. Document any changes.
      </div>

      <h2>Tax slabs</h2>
      <p>
        <code>/settings/tax</code> holds slabs per FY and per regime (NEW / OLD). Standard deduction,
        rebate (Sec 87A), surcharge brackets, cess. Populate at the start of every FY before the first
        payslip; the engine refuses to compute if slabs are missing.
      </p>

      <h2>PT slabs</h2>
      <p>
        Professional Tax is half-yearly and state-specific. Tamil Nadu, Karnataka, Maharashtra, etc.
        all have different brackets. Each location ties to a state; the PT slab is picked by the
        employee&apos;s location_id.
      </p>

      <h2>Custom pay components</h2>
      <p>
        Define org-specific earnings (Special Bonus, Project Allowance) or deductions (Canteen, Loan
        Recovery). Each can be a fixed amount, a percentage, or a formula. Assign to specific employees
        via Recurring Components on the employee detail page.
      </p>

      <h2>Users &amp; roles</h2>
      <p>
        Invite from <code>/users</code> → New. Set the role on creation: <code>admin</code> / <code>hr</code>
        / <code>payroll</code> / <code>employee</code>. Linking a user to an employee record happens
        automatically when their <code>work_email</code> matches.
      </p>
    </>
  )
}
