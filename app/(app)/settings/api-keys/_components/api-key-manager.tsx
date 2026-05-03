'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useBlockingTransition } from '@/lib/ui/action-blocker'
import { useSnackbar } from '@/components/ui/snackbar'
import { useConfirm } from '@/components/ui/confirm'
import { createApiKeyAction, revokeApiKeyAction } from '@/lib/api/actions'

type Key = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  is_active: boolean
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

const ALL_SCOPES = [
  { value: 'projects:read',        label: 'Projects — read' },
  { value: 'projects:write',       label: 'Projects — write (create)' },
  { value: 'activity_types:read',  label: 'Activity types — read' },
  { value: 'activity_types:write', label: 'Activity types — write (create)' },
  { value: 'timesheet:read',       label: 'Timesheet — read entries' },
  { value: 'timesheet:write',      label: 'Timesheet — bulk create entries' },
] as const

export function ApiKeyManager({ keys }: { keys: Key[] }) {
  const router = useRouter()
  const snack = useSnackbar()
  const confirm = useConfirm()
  const [pending, startTransition] = useBlockingTransition()
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<Set<string>>(new Set(['projects:read', 'activity_types:read']))
  const [reveal, setReveal] = React.useState<{ secret: string; prefix: string; name: string } | null>(null)
  const [copied, setCopied] = React.useState(false)

  const toggleScope = (s: string) => {
    setScopes((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (scopes.size === 0) {
      snack.show({ kind: 'warn', message: 'Pick at least one scope.' })
      return
    }
    const fd = new FormData()
    fd.set('name', name.trim())
    for (const s of scopes) fd.append('scopes', s)
    startTransition(async () => {
      const res = await createApiKeyAction(fd)
      if (res.error || !res.secret) {
        snack.show({ kind: 'error', message: res.error ?? 'Failed to create API key.' })
        return
      }
      setReveal({ secret: res.secret, prefix: res.prefix ?? '', name: name.trim() })
      setName('')
      router.refresh()
    })
  }

  const onCopy = async () => {
    if (!reveal) return
    try {
      await navigator.clipboard.writeText(reveal.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      snack.show({ kind: 'error', message: 'Copy failed — select the value and copy manually.' })
    }
  }

  const dismissReveal = async () => {
    if (!reveal) return
    if (!await confirm({
      title: 'Did you copy the key?',
      body: 'Once you close this dialog the secret is gone — only the hash is stored. You can revoke and create a new one if needed.',
      confirmLabel: "Yes, I've saved it",
    })) return
    setReveal(null)
  }

  const onRevoke = async (key: Key) => {
    if (!await confirm({
      title: `Revoke "${key.name}"?`,
      body: `Any application using this key (${key.prefix}…) will start getting 401 immediately. This cannot be undone.`,
      confirmLabel: 'Revoke',
      tone: 'danger',
    })) return
    const fd = new FormData()
    fd.set('id', key.id)
    startTransition(async () => {
      const res = await revokeApiKeyAction(fd)
      if (res.error) snack.show({ kind: 'error', message: res.error })
      else { snack.show({ kind: 'success', message: 'Key revoked.' }); router.refresh() }
    })
  }

  return (
    <>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Create new key</h2>

      <form onSubmit={submit} className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Label</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mobile app — production"
            required
            maxLength={120}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-300">Scopes</div>
          <div className="grid gap-1 sm:grid-cols-2">
            {ALL_SCOPES.map((s) => (
              <label key={s.value} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={scopes.has(s.value)}
                  onChange={() => toggleScope(s.value)}
                />
                <span className="font-mono text-[11px] text-slate-500">{s.value}</span>
                <span className="text-slate-700 dark:text-slate-300">— {s.label}</span>
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={pending || !name.trim() || scopes.size === 0}
          className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create API key'}
        </button>
      </form>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Active &amp; revoked keys ({keys.length})</h3>
      {keys.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No API keys yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2">Scopes</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Last used</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">{' '}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{k.name}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{k.prefix}…</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <span key={s} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{fmt(k.created_at)}</td>
                  <td className="px-3 py-2 text-slate-500">{k.last_used_at ? fmt(k.last_used_at) : '—'}</td>
                  <td className="px-3 py-2">
                    {k.is_active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">active</span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        revoked {k.revoked_at ? `· ${fmt(k.revoked_at)}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {k.is_active && (
                      <button
                        type="button"
                        onClick={() => onRevoke(k)}
                        disabled={pending}
                        className="text-[11px] font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reveal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-amber-300 bg-white shadow-2xl dark:border-amber-800 dark:bg-slate-900">
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-900 dark:bg-amber-950/40">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <span aria-hidden>⚠</span> Copy this secret now — it won&apos;t be shown again.
              </div>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                Only the hash is stored. If you lose this value, revoke the key and mint a new one.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Key <strong>{reveal.name}</strong> ({reveal.prefix}…)
              </div>
              <div className="break-all rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                {reveal.secret}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCopy}
                  className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {copied ? '✓ Copied' : 'Copy to clipboard'}
                </button>
                <button
                  type="button"
                  onClick={dismissReveal}
                  className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
                >
                  I&apos;ve saved it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
