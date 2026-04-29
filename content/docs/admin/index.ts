import type { ComponentType } from 'react'
import type { DocMeta } from '@/components/docs/doc-layout'

import { meta as overviewMeta,       default as Overview }       from './overview'
import { meta as employeesMeta,      default as Employees }      from './employees'
import { meta as leavePoliciesMeta,  default as LeavePolicies }  from './leave-policies'
import { meta as leaveBalancesMeta,  default as LeaveBalances }  from './leave-balances'
import { meta as monthlyPlansMeta,   default as MonthlyPlans }   from './monthly-plans'
import { meta as compOffMeta,        default as CompOff }        from './comp-off'
import { meta as holidaysMeta,       default as Holidays }       from './holidays'
import { meta as timesheetMeta,      default as Timesheet }      from './timesheet'
import { meta as payrollMeta,        default as Payroll }        from './payroll'
import { meta as tdsMeta,            default as Tds }            from './tds'
import { meta as priorEarningsMeta,  default as PriorEarnings }  from './prior-earnings'
import { meta as reportsMeta,        default as Reports }        from './reports'
import { meta as settingsMeta,       default as Settings }       from './settings'

export type DocEntry = { meta: DocMeta; Component: ComponentType }

export const ADMIN_DOCS: DocEntry[] = [
  { meta: overviewMeta,       Component: Overview       },
  { meta: settingsMeta,       Component: Settings       },
  { meta: employeesMeta,      Component: Employees      },
  { meta: leavePoliciesMeta,  Component: LeavePolicies  },
  { meta: leaveBalancesMeta,  Component: LeaveBalances  },
  { meta: monthlyPlansMeta,   Component: MonthlyPlans   },
  { meta: compOffMeta,        Component: CompOff        },
  { meta: holidaysMeta,       Component: Holidays       },
  { meta: timesheetMeta,      Component: Timesheet      },
  { meta: payrollMeta,        Component: Payroll        },
  { meta: tdsMeta,            Component: Tds            },
  { meta: priorEarningsMeta,  Component: PriorEarnings  },
  { meta: reportsMeta,        Component: Reports        },
]

export const ADMIN_DOCS_BY_SLUG: Record<string, DocEntry> = Object.fromEntries(
  ADMIN_DOCS.map((e) => [e.meta.slug, e]),
)
