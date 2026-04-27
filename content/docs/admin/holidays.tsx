import type { DocMeta } from '@/components/docs/doc-layout'

export const meta: DocMeta = {
  slug: 'holidays',
  title: 'Holiday calendar',
  summary: 'Manage per-FY holidays, mark weekends in bulk, and upload a CSV.',
  group: 'Leave',
}

export default function Article() {
  return (
    <>
      <h2>Structure</h2>
      <p>
        <code>/settings/holidays</code> is a <strong>per-FY</strong> index. Each card represents one FY
        (e.g. <code>2026-27</code>) and shows holiday count plus scope summary. Click a card to open
        that year&apos;s detail page.
      </p>
      <p>
        On the detail page (<code>/settings/holidays/&#91;fy&#93;</code>) you have:
      </p>
      <ul>
        <li><strong>Add holiday</strong> form — single row insert.</li>
        <li><strong>Mark weekends</strong> — bulk-create Saturdays / Sundays for a range.</li>
        <li><strong>Upload CSV</strong> — file-based bulk upload with a downloadable template.</li>
        <li>Holiday table — edit or delete each row.</li>
      </ul>

      <h2>Holiday scope</h2>
      <p>Each holiday has two scope keys:</p>
      <ul>
        <li><strong>project_id</strong> — null = applies to all projects, or a specific project ID.</li>
        <li><strong>location_id</strong> — null = all locations, or a specific location ID.</li>
      </ul>
      <p>
        An employee&apos;s effective holiday list = global ∪ their location ∪ their primary project.
        This is what <code>/me/holidays</code> shows them.
      </p>
      <div className="callout callout-tip">
        <strong>Scoping convention:</strong> use project for client-specific holidays (e.g., US client = Thanksgiving),
        location for state holidays (e.g., Tamil Nadu = Pongal), and leave both null for company-wide
        holidays (e.g., Independence Day).
      </div>

      <h2>Marking weekends</h2>
      <p>
        Use the Weekend sweeper card on the FY detail page. Choose:
      </p>
      <ul>
        <li><strong>From / To</strong> — defaults to FY start / end (e.g., 2026-04-01 → 2027-03-31 for FY 2026-27).</li>
        <li>Tick Saturdays / Sundays / both.</li>
        <li>Label (default &quot;Weekly off&quot;), type (default <code>restricted</code>).</li>
        <li>Project / location scope.</li>
      </ul>
      <p>
        Re-running is safe — existing rows in the same scope are skipped. The result message shows
        &quot;Added X, skipped Y already-existing&quot;.
      </p>

      <h2>CSV upload</h2>
      <p>
        Click <strong>Upload CSV</strong> in the FY page header. Download the template first
        (<code>/api/templates/holidays</code>); columns are:
      </p>
      <pre><code>financial_year, holiday_date, name, type, project_code, location_code</code></pre>
      <ul>
        <li><code>type</code> = <code>public</code> / <code>restricted</code> / <code>optional</code>.</li>
        <li><code>project_code</code> / <code>location_code</code> can be left blank for global.</li>
      </ul>
      <p>
        Rows are inserted one-at-a-time so a single bad row doesn&apos;t blow up the batch — bad rows are
        reported in the upload result&apos;s <code>skipped</code> list.
      </p>
    </>
  )
}
