import { requireRouteRoles } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { ApiKeyManager } from './_components/api-key-manager'

export const metadata = { title: 'API keys' }

type Row = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  is_active: boolean
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export default async function ApiKeysPage() {
  await requireRouteRoles('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, prefix, scopes, is_active, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const keys = (data ?? []) as Row[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        back={{ href: '/settings', label: 'Settings' }}
        subtitle="Machine-to-machine credentials for /api/v1. Keys are hashed at rest — the plain secret is shown once on creation; copy it then. Revoke any key whose secret may have leaked."
      />

      <Card className="p-5">
        <ApiKeyManager keys={keys} />
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">How to use</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Send the key in either header on every request:</p>
        <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
{`Authorization: Bearer pf_live_xxxxxxxx
# or
X-API-Key: pf_live_xxxxxxxx`}
        </pre>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Endpoints</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
          <li><code>GET    /api/v1/projects</code> — list (scope: <code>projects:read</code>)</li>
          <li><code>GET    /api/v1/projects/{'{code}'}</code> — get by code (scope: <code>projects:read</code>)</li>
          <li><code>POST   /api/v1/projects</code> — create (scope: <code>projects:write</code>)</li>
          <li><code>GET    /api/v1/activity-types</code> — list (scope: <code>activity_types:read</code>)</li>
          <li><code>GET    /api/v1/activity-types/{'{code}'}</code> — get by code (scope: <code>activity_types:read</code>)</li>
          <li><code>POST   /api/v1/activity-types</code> — create (scope: <code>activity_types:write</code>)</li>
          <li><code>GET    /api/v1/timesheet/entries</code> — list (scope: <code>timesheet:read</code>)</li>
          <li><code>POST   /api/v1/timesheet/entries</code> — bulk create (scope: <code>timesheet:write</code>)</li>
        </ul>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Create body — masters</h3>
        <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
{`POST /api/v1/projects
{
  "code": "ACME",
  "name": "Acme Platform",
  "client": "Acme Inc.",
  "is_active": true
}`}
        </pre>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Bulk timesheet — multi-employee body</h3>
        <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
{`POST /api/v1/timesheet/entries
{
  "employees": [
    {
      "employee_code": "AALAM0123",
      "week_status": "approved",       // optional, per-employee — see below
      "entries": [
        { "entry_date": "2026-04-21", "project_code": "ACME", "activity_code": "DEV",
          "task": "Frontend", "hours": 4, "work_mode": "WFO" },
        { "entry_date": "2026-04-22", "project_code": "ACME", "activity_code": "MEETING",
          "start_time": "13:30", "end_time": "14:00" }
      ]
    },
    {
      "employee_code": "AALAM0124",
      "entries": [
        { "entry_date": "2026-04-21", "project_code": "ACME", "activity_code": "REVIEW",
          "hours": 6, "work_mode": "WFH" }
      ]
    }
  ]
}
// → {
//     data: {
//       employees: [
//         { employee_code, employee_found, week_status, created, skipped, weeks_touched, total_submitted },
//         …
//       ],
//       totals: { created, skipped, submitted, employees_succeeded, employees_failed }
//     }
//   }`}
        </pre>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Single-employee body (also accepted)</h3>
        <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
{`POST /api/v1/timesheet/entries
{
  "employee_code": "AALAM0123",
  "week_status": "approved",
  "entries": [ … ]
}
// Internally treated as a single-element "employees" array; same response shape.`}
        </pre>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">week_status — optional</h3>
        <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
          Default behaviour (omit <code>week_status</code>): entries land in <strong>draft</strong>; weeks already in <code>submitted</code> / <code>approved</code> are skipped with a per-row reason.
        </p>
        <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
          When provided, every week touched by <code>entries</code> is set to that status <em>after</em> the rows land — and the editable-week guard is bypassed. Use this when mirroring an already-approved timesheet from another system.
        </p>
        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
          <li><code>{'"draft"'}</code> — clears <code>submitted_at</code> / <code>approved_at</code>; week becomes editable again.</li>
          <li><code>{'"submitted"'}</code> — sets <code>submitted_at = now()</code>, clears any approval.</li>
          <li><code>{'"approved"'}</code> — sets <code>submitted_at</code> + <code>approved_at = now()</code>, marks <code>decision_note</code> = <em>Imported via API</em>.</li>
          <li><code>{'"rejected"'}</code> — clears <code>approved_at</code>, marks the rejection.</li>
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">
          List endpoints accept <code>?active=true|false</code>, <code>?limit</code>, <code>?offset</code>.
          Timesheet list also takes <code>?employee_code</code> (required), <code>?from</code>, <code>?to</code>.
          Bulk timesheet POSTs cap at <strong>1000 total entries per call</strong> across every employee; rows sharing <code>(date, project, activity, task, mode)</code> have their hours summed within an employee.
          Unknown <code>employee_code</code> in multi-employee mode does not fail the whole call — that slice is returned with <code>employee_found: false</code> and a row-level skip reason.
          Responses are <code>{'{ data, meta? }'}</code> on success, <code>{'{ error: { code, message } }'}</code> on failure.
        </p>
      </Card>
    </div>
  )
}
