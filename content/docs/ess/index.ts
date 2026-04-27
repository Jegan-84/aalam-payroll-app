import type { ComponentType } from 'react'
import type { DocMeta } from '@/components/docs/doc-layout'

import { meta as overviewMeta,       default as Overview }       from './overview'
import { meta as leaveMeta,          default as Leave }          from './leave'
import { meta as compOffMeta,        default as CompOff }        from './comp-off'
import { meta as holidaysMeta,       default as Holidays }       from './holidays'
import { meta as payslipsMeta,       default as Payslips }       from './payslips'
import { meta as taxDeclMeta,        default as TaxDecl }        from './tax-declaration'
import { meta as reimbMeta,          default as Reimb }          from './reimbursements'

export type DocEntry = { meta: DocMeta; Component: ComponentType }

// Order here drives the index display + prev/next nav.
export const ESS_DOCS: DocEntry[] = [
  { meta: overviewMeta,  Component: Overview  },
  { meta: leaveMeta,     Component: Leave     },
  { meta: compOffMeta,   Component: CompOff   },
  { meta: holidaysMeta,  Component: Holidays  },
  { meta: payslipsMeta,  Component: Payslips  },
  { meta: taxDeclMeta,   Component: TaxDecl   },
  { meta: reimbMeta,     Component: Reimb     },
]

export const ESS_DOCS_BY_SLUG: Record<string, DocEntry> = Object.fromEntries(
  ESS_DOCS.map((e) => [e.meta.slug, e]),
)
