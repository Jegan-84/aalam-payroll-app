/**
 * Leave engine — pure helpers.
 *
 * Day counting rules (org-wide): a leave day is a calendar day in the
 * from–to range that is NOT a weekly-off day and NOT a public holiday.
 */

export function iterateDatesInclusive(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  const start = new Date(fromIso + 'T00:00:00Z')
  const end = new Date(toIso + 'T00:00:00Z')
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Count leave days across [fromIso, toIso] inclusive. Excludes weekly-offs
 * and listed holidays. Caller supplies the relevant holiday set (ideally
 * pre-filtered to the FY or the date range).
 */
export function countLeaveDays(
  fromIso: string,
  toIso: string,
  ctx: { weeklyOffDays: number[]; holidayDates: Set<string> },
): number {
  let n = 0
  for (const iso of iterateDatesInclusive(fromIso, toIso)) {
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay()
    if (ctx.weeklyOffDays.includes(dow)) continue
    if (ctx.holidayDates.has(iso)) continue
    n += 1
  }
  return n
}

/**
 * Resolve the financial-year window that contains `date`, using
 * `fyStartMonth` (1=Jan .. 12=Dec). Indian default is 4 (April).
 *
 *   fyStartMonth=4, date=2026-06-15 → 2026-04-01 .. 2027-03-31
 *   fyStartMonth=4, date=2026-02-10 → 2025-04-01 .. 2026-03-31
 */
export function resolveFy(date: Date, fyStartMonth: number): { fyStart: string; fyEnd: string; label: string } {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1       // 1-12
  const startYear = m >= fyStartMonth ? y : y - 1
  const endYear = startYear + 1
  const startMonth = String(fyStartMonth).padStart(2, '0')
  const endMonthIdx = ((fyStartMonth + 10) % 12) + 1   // month before start
  const endMonth = String(endMonthIdx).padStart(2, '0')
  const endDay = new Date(Date.UTC(endYear, endMonthIdx, 0)).getUTCDate()
  return {
    fyStart: `${startYear}-${startMonth}-01`,
    fyEnd: `${endYear}-${endMonth}-${String(endDay).padStart(2, '0')}`,
    label: `${startYear}-${String(endYear).slice(2)}`,
  }
}
