'use client'

import Link from 'next/link'
import * as React from 'react'
import { Card } from '@/components/ui/card'
import { ConvertTypeButton } from '../../_components/convert-type-button'

type LinkAction = {
  kind: 'link'
  href: string
  title: string
  hint: string
  tone: TileTone
  icon: React.ReactNode
}

type ButtonAction = {
  kind: 'button'
  // For client-side dialogs / mutations. The render function gets the tile
  // chrome and decides what to wrap it with.
  render: (tile: React.ReactNode) => React.ReactNode
  title: string
  hint: string
  tone: TileTone
  icon: React.ReactNode
}

type TileAction = LinkAction | ButtonAction
type TileTone = 'brand' | 'sky' | 'amber' | 'emerald' | 'violet' | 'rose'

const TONE_CLASSES: Record<TileTone, string> = {
  brand:   'bg-brand-50   text-brand-700   ring-brand-100   dark:bg-brand-950/40   dark:text-brand-300   dark:ring-brand-900',
  sky:     'bg-sky-50     text-sky-700     ring-sky-100     dark:bg-sky-950/40     dark:text-sky-300     dark:ring-sky-900',
  amber:   'bg-amber-50   text-amber-700   ring-amber-100   dark:bg-amber-950/40   dark:text-amber-300   dark:ring-amber-900',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  violet:  'bg-violet-50  text-violet-700  ring-violet-100  dark:bg-violet-950/40  dark:text-violet-300  dark:ring-violet-900',
  rose:    'bg-rose-50    text-rose-700    ring-rose-100    dark:bg-rose-950/40    dark:text-rose-300    dark:ring-rose-900',
}

export function EmployeeActionsCard({
  employeeId, employeeLabel, currentType,
}: {
  employeeId: string
  employeeLabel: string
  currentType: string
}) {
  const actions: TileAction[] = [
    {
      kind: 'link',
      href: `/employees/${employeeId}/salary`,
      title: 'Salary structure',
      hint: 'Components and CTC split',
      tone: 'brand',
      icon: <IconCoins />,
    },
    {
      kind: 'link',
      href: `/employees/${employeeId}/components`,
      title: 'Recurring components',
      hint: 'Allowances and deductions',
      tone: 'sky',
      icon: <IconLayers />,
    },
    {
      kind: 'link',
      href: `/employees/${employeeId}/declaration`,
      title: 'Tax declaration',
      hint: '80C, HRA, regime choice',
      tone: 'violet',
      icon: <IconDoc />,
    },
    {
      kind: 'link',
      href: `/employees/${employeeId}/loans`,
      title: 'Loans',
      hint: 'Active EMIs and history',
      tone: 'emerald',
      icon: <IconBank />,
    },
    {
      kind: 'button',
      render: (tile) => (
        <ConvertTypeButton
          employeeId={employeeId}
          currentType={currentType}
          employeeLabel={employeeLabel}
          renderTrigger={(open) => (
            <button type="button" onClick={open} className="block w-full text-left">
              {tile}
            </button>
          )}
        />
      ),
      title: 'Convert employment type',
      hint: `Currently ${currentType.replace('_', ' ')} — change & reconcile leave`,
      tone: 'amber',
      icon: <IconShuffle />,
    },
    {
      kind: 'link',
      href: `/employees/${employeeId}/fnf`,
      title: 'F&F settlement',
      hint: 'Final settlement and exit',
      tone: 'rose',
      icon: <IconExit />,
    },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Quick actions</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Compensation, tax, loans, and lifecycle changes for this employee.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-800">
        {actions.map((a) => {
          const tile = <Tile icon={a.icon} title={a.title} hint={a.hint} tone={a.tone} />
          if (a.kind === 'button') return <React.Fragment key={a.title}>{a.render(tile)}</React.Fragment>
          return (
            <Link key={a.title} href={a.href} className="block">
              {tile}
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

// -----------------------------------------------------------------------------
function Tile({
  icon, title, hint, tone,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  tone: TileTone
}) {
  return (
    <div className="group flex h-full items-start gap-3 bg-white p-4 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-950/60">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 group-hover:text-brand-700 dark:text-slate-50 dark:group-hover:text-brand-300">
            {title}
          </span>
          <span className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-slate-600">
            ›
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
const iconProps = {
  width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24',
}
function IconCoins()    { return <svg {...iconProps}><circle cx="8" cy="8" r="5"/><path d="M16 8a5 5 0 1 1-4 4.9"/><path d="M8 6v4l2 1"/></svg> }
function IconLayers()   { return <svg {...iconProps}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg> }
function IconDoc()      { return <svg {...iconProps}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg> }
function IconBank()     { return <svg {...iconProps}><path d="M3 10 12 4l9 6"/><path d="M5 10v8"/><path d="M19 10v8"/><path d="M9 14v4"/><path d="M15 14v4"/><path d="M3 20h18"/></svg> }
function IconShuffle()  { return <svg {...iconProps}><path d="M16 3h5v5"/><path d="M21 3 9 15"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M3 8h3l3 3"/><path d="m3 21 6-6"/></svg> }
function IconExit()     { return <svg {...iconProps}><path d="M9 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9"/><path d="m14 17-5-5 5-5"/><path d="M9 12h10"/></svg> }
