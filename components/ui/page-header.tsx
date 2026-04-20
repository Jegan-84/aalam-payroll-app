import * as React from 'react'

export type PageHeaderProps = {
  title: string
  subtitle?: string
  back?: { href: string; label: string }
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        {back && (
          <a
            href={back.href}
            className="text-xs text-slate-500 hover:text-brand-600 hover:underline"
          >
            ← {back.label}
          </a>
        )}
        <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
