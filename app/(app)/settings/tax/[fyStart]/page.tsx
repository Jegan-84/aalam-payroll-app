import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFyRegimeBundle } from '@/lib/settings/tax-queries'
import { SlabsEditor } from './_components/slabs-editor'
import { ConfigForm } from './_components/config-form'

export const metadata = { title: 'Edit tax year' }

type PP = Promise<{ fyStart: string }>

const DEFAULT_CONFIG = {
  standard_deduction: 0,
  rebate_87a_income_limit: 0,
  rebate_87a_max_amount: 0,
  cess_percent: 4,
  surcharge_enabled: true,
}

export default async function TaxFyPage({ params }: { params: PP }) {
  const { fyStart } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fyStart)) notFound()

  const [newBundle, oldBundle] = await Promise.all([
    getFyRegimeBundle(fyStart, 'NEW'),
    getFyRegimeBundle(fyStart, 'OLD'),
  ])
  if (!newBundle || !oldBundle) notFound()

  // All FY records share the same fyEnd by construction
  const fyEnd =
    newBundle.slabs[0]
      ? ''   // fyEnd isn't returned in the slab select; we need to pull from one of the source rows. Use a date one year later as a safe fallback.
      : ''
  const fyEndFallback = computeFyEnd(fyStart)
  const fyLabel = `${fyStart.slice(0, 4)}-${String(Number(fyStart.slice(0, 4)) + 1).slice(2)}`

  return (
    <div className="space-y-5">
      <div>
        <Link href="/settings/tax" className="text-sm text-slate-500 hover:underline">← Tax settings</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          FY {fyLabel} <span className="text-base font-normal text-slate-500">({fyStart})</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Edit slabs, config, and surcharge per regime. &quot;Save&quot; replaces all rows in that section for this FY.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">New Regime</h2>
        <SlabsEditor
          fyStart={fyStart}
          fyEnd={fyEnd || fyEndFallback}
          regime="NEW"
          kind="slabs"
          initial={newBundle.slabs.map((s) => ({ min: Number(s.taxable_income_min), max: s.taxable_income_max == null ? null : Number(s.taxable_income_max), rate: Number(s.rate_percent) }))}
        />
        <ConfigForm
          fyStart={fyStart}
          fyEnd={fyEnd || fyEndFallback}
          regime="NEW"
          initial={newBundle.config ?? DEFAULT_CONFIG}
        />
        <SlabsEditor
          fyStart={fyStart}
          fyEnd={fyEnd || fyEndFallback}
          regime="NEW"
          kind="surcharge"
          initial={newBundle.surchargeSlabs.map((s) => ({ min: Number(s.taxable_income_min), max: s.taxable_income_max == null ? null : Number(s.taxable_income_max), rate: Number(s.surcharge_percent) }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Old Regime</h2>
        <SlabsEditor
          fyStart={fyStart}
          fyEnd={fyEnd || fyEndFallback}
          regime="OLD"
          kind="slabs"
          initial={oldBundle.slabs.map((s) => ({ min: Number(s.taxable_income_min), max: s.taxable_income_max == null ? null : Number(s.taxable_income_max), rate: Number(s.rate_percent) }))}
        />
        <ConfigForm
          fyStart={fyStart}
          fyEnd={fyEnd || fyEndFallback}
          regime="OLD"
          initial={oldBundle.config ?? DEFAULT_CONFIG}
        />
        <SlabsEditor
          fyStart={fyStart}
          fyEnd={fyEnd || fyEndFallback}
          regime="OLD"
          kind="surcharge"
          initial={oldBundle.surchargeSlabs.map((s) => ({ min: Number(s.taxable_income_min), max: s.taxable_income_max == null ? null : Number(s.taxable_income_max), rate: Number(s.surcharge_percent) }))}
        />
      </section>
    </div>
  )
}

function computeFyEnd(fyStart: string): string {
  const d = new Date(fyStart + 'T00:00:00Z')
  d.setUTCFullYear(d.getUTCFullYear() + 1)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
