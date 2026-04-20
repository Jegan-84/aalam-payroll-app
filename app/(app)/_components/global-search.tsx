'use client'
/* eslint-disable react-hooks/set-state-in-effect --
   This component uses the standard debounced-fetch pattern (cancel on new query,
   set loading flag, commit results). The rule is useful elsewhere but flags this
   legitimate pattern with no cleaner alternative.
*/

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import type { SearchGroup, SearchItem } from '@/app/api/search/route'

const MIN_QUERY_LEN = 2

export function GlobalSearch() {
  const router = useRouter()
  const [q, setQ] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [groups, setGroups] = React.useState<SearchGroup[]>([])
  const [loading, setLoading] = React.useState(false)
  const [cursor, setCursor] = React.useState(0)

  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  const flat = React.useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Cmd/Ctrl+K — global shortcut
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Close on click-outside
  React.useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Debounced fetch + abort-on-new-query
  React.useEffect(() => {
    const needle = q.trim()
    if (needle.length < MIN_QUERY_LEN) {
      setGroups([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      fetch(`/api/search?q=${encodeURIComponent(needle)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: { groups: SearchGroup[] }) => {
          setGroups(data.groups ?? [])
          setCursor(0)
        })
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') console.error(err)
        })
        .finally(() => setLoading(false))
    }, 180)
    return () => window.clearTimeout(timer)
  }, [q])

  const navigate = (item: SearchItem) => {
    setOpen(false)
    setQ('')
    router.push(item.href)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, Math.max(flat.length - 1, 0))) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') {
      const item = flat[cursor]
      if (item) { e.preventDefault(); navigate(item) }
    }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  const showEmpty = open && q.trim().length >= MIN_QUERY_LEN && !loading && flat.length === 0

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <IconSearch />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search employees, companies, cycles…"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-20 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </div>

      {open && q.trim().length >= MIN_QUERY_LEN && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
              <Spinner size="xs" /> Searching…
            </div>
          )}

          {!loading && flat.length > 0 && (
            <div>
              {groups.map((g, gi) => {
                const startIdx = groups.slice(0, gi).reduce((s, x) => s + x.items.length, 0)
                return (
                  <div key={g.label} className="border-b border-slate-100 py-1.5 last:border-b-0 dark:border-slate-800">
                    <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {g.label}
                    </div>
                    {g.items.map((item, i) => {
                      const idx = startIdx + i
                      const active = idx === cursor
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => navigate(item)}
                          className={[
                            'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                            active
                              ? 'bg-brand-50 text-brand-900 dark:bg-brand-950/50 dark:text-brand-100'
                              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                          ].join(' ')}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <KindChip kind={item.kind} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-slate-900 dark:text-slate-100">{item.title}</div>
                              {item.subtitle && (
                                <div className="truncate text-xs text-slate-500">{item.subtitle}</div>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 text-[11px] ${active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'}`}>
                            ↵
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {showEmpty && (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              No results for &ldquo;{q}&rdquo;.
            </div>
          )}

          <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
            <span className="mr-3"><kbd className="rounded border border-slate-300 bg-white px-1 dark:border-slate-700 dark:bg-slate-800">↑</kbd> <kbd className="rounded border border-slate-300 bg-white px-1 dark:border-slate-700 dark:bg-slate-800">↓</kbd> navigate</span>
            <span className="mr-3"><kbd className="rounded border border-slate-300 bg-white px-1 dark:border-slate-700 dark:bg-slate-800">↵</kbd> open</span>
            <span><kbd className="rounded border border-slate-300 bg-white px-1 dark:border-slate-700 dark:bg-slate-800">esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  )
}

function KindChip({ kind }: { kind: SearchItem['kind'] }) {
  const config: Record<SearchItem['kind'], { icon: React.ReactNode; tone: string }> = {
    employee:    { icon: <IconPerson />, tone: 'bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300' },
    company:     { icon: <IconBuilding />, tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
    department:  { icon: <IconFolder />, tone: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
    designation: { icon: <IconTag />, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
    cycle:       { icon: <IconPlay />, tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
    leave:       { icon: <IconSun />, tone: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-300' },
    page:        { icon: <IconLink />, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  }
  const c = config[kind]
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${c.tone}`}>
      {c.icon}
    </span>
  )
}

const sp = { width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
function IconSearch()   { return <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg> }
function IconPerson()   { return <svg {...sp}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg> }
function IconBuilding() { return <svg {...sp}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2"/><path d="M14 7h2"/><path d="M8 11h2"/><path d="M14 11h2"/><path d="M8 15h2"/><path d="M14 15h2"/></svg> }
function IconFolder()   { return <svg {...sp}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg> }
function IconTag()      { return <svg {...sp}><path d="M20 12 12 20l-8-8V4h8Z"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg> }
function IconPlay()     { return <svg {...sp}><polygon points="6,4 20,12 6,20" /></svg> }
function IconSun()      { return <svg {...sp}><circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1"/></svg> }
function IconLink()     { return <svg {...sp}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg> }
