import * as React from 'react'

export function Card({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`border-b border-slate-100 px-5 py-4 dark:border-slate-800 ${className}`} />
}

export function CardTitle({ className = '', ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...rest} className={`text-sm font-semibold text-slate-900 dark:text-slate-50 ${className}`} />
}

export function CardBody({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`p-5 ${className}`} />
}

export function CardFooter({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40 ${className}`}
    />
  )
}
