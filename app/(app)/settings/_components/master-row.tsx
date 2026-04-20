'use client'

import { useActionState, useState } from 'react'

type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'checkbox'
  placeholder?: string
  upper?: boolean
  readOnly?: boolean
  colWidth?: string // tailwind width e.g. 'w-28'
}

type Result = { ok?: boolean; errors?: Record<string, string[] | undefined> } | undefined

type Props = {
  action: (prev: Result, fd: FormData) => Promise<Result>
  fields: FieldDef[]
  defaults?: Record<string, string | number | boolean | null | undefined>
  idKey?: string                  // which field holds the PK (default 'id')
  saveLabel?: string
  submitKey?: string              // key to render at the end (usually a hidden id)
}

export function MasterRow({ action, fields, defaults = {}, idKey = 'id', saveLabel = 'Save', submitKey }: Props) {
  const [state, formAction, pending] = useActionState<Result, FormData>(action, undefined)
  const [justSaved, setJustSaved] = useState(false)
  const err = (k: string) => state?.errors?.[k]?.[0]

  // Show "saved" briefly after success
  if (state?.ok && !justSaved) setJustSaved(true)
  else if (!state?.ok && justSaved) setJustSaved(false)

  return (
    <form action={formAction} className="space-y-1">
      {defaults[idKey] != null && <input type="hidden" name={idKey} value={String(defaults[idKey])} />}
      {submitKey && <input type="hidden" name={submitKey} value="" />}

      {state?.errors?._form && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {state.errors._form[0]}
        </div>
      )}
      {justSaved && !state?.errors && (
        <div role="status" className="text-xs text-green-700 dark:text-green-400">Saved.</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {fields.map((f) => {
          const v = defaults[f.key]
          if (f.type === 'checkbox') {
            return (
              <label key={f.key} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  name={f.key}
                  defaultChecked={v !== false && v !== 'false' && v !== 0}
                />
                {f.label}
              </label>
            )
          }
          return (
            <div key={f.key} className="flex flex-col">
              <input
                name={f.key}
                defaultValue={v == null ? '' : String(v)}
                placeholder={f.placeholder ?? f.label}
                readOnly={f.readOnly}
                onInput={f.upper ? (e) => { (e.currentTarget as HTMLInputElement).value = (e.currentTarget as HTMLInputElement).value.toUpperCase() } : undefined}
                className={`h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950 ${f.colWidth ?? 'w-44'} ${f.readOnly ? 'bg-slate-50 dark:bg-slate-900' : ''}`}
              />
              {err(f.key) && <span className="text-[11px] text-red-600">{err(f.key)}</span>}
            </div>
          )
        })}

        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {pending ? '…' : saveLabel}
        </button>
      </div>
    </form>
  )
}
