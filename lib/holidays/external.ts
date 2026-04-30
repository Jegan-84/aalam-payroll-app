import 'server-only'

// -----------------------------------------------------------------------------
// External holiday provider — Calendarific (key-based).
// Returns an `ImportedHoliday` shape so the UI can render the list directly.
// -----------------------------------------------------------------------------

export type HolidayType = 'public' | 'restricted' | 'optional'

export type ImportedHoliday = {
  /** Stable id within a provider's response — for client-side dedupe. */
  key: string
  /** ISO YYYY-MM-DD */
  date: string
  name: string
  type: HolidayType
  /** Region / state codes if the provider returned them (e.g. 'IN-TN'). */
  regions: string[] | null
  /** Provider that returned this row. */
  source: 'calendarific'
}

export type Provider = 'calendarific'

export type ProviderInfo = {
  id: Provider
  label: string
  helper: string
  available: boolean
  /** Reason it's not available (e.g. missing API key). */
  unavailableReason?: string
  /** Whether the provider supports a state/region filter. */
  supportsRegion: boolean
}

export function listProviders(): ProviderInfo[] {
  const calendarificKey = process.env.CALENDARIFIC_API_KEY
  return [
    {
      id: 'calendarific',
      label: 'Calendarific',
      helper: 'Free tier: 1,000 calls/month. Full India coverage including state-wise (IN-TN, IN-KA, …).',
      available: Boolean(calendarificKey),
      unavailableReason: calendarificKey ? undefined : 'Set CALENDARIFIC_API_KEY in .env.local to enable.',
      supportsRegion: true,
    },
  ]
}

// -----------------------------------------------------------------------------
// Calendarific — https://calendarific.com/api-documentation
// GET https://calendarific.com/api/v2/holidays
//   ?api_key=KEY&country=IN&year=2026&location=IN-TN&type=national,local
// Response: { response: { holidays: [{ name, date: { iso }, type: ['National holiday'], states }] } }
// -----------------------------------------------------------------------------
type CalRow = {
  name: string
  description?: string
  date: { iso: string }
  type: string[]
  states?: Array<{ iso: string; name: string }> | null | string
}

export async function fetchFromCalendarific(
  country: string,
  year: number,
  region?: string,
): Promise<ImportedHoliday[]> {
  const apiKey = process.env.CALENDARIFIC_API_KEY
  if (!apiKey) throw new Error('CALENDARIFIC_API_KEY is not set on the server')

  const params = new URLSearchParams({
    api_key: apiKey,
    country: country.toUpperCase(),
    year: String(year),
  })
  if (region) params.set('location', region)
  // National + local; skip pure observance noise.
  params.set('type', 'national,local,religious')

  const json = await fetchJsonSafe<{ response?: { holidays?: CalRow[] } }>(
    `https://calendarific.com/api/v2/holidays?${params.toString()}`,
    'Calendarific',
  )
  const rows = json?.response?.holidays ?? []
  return rows.map((r, idx) => {
    const iso = r.date.iso.slice(0, 10)
    const states = Array.isArray(r.states)
      ? r.states.map((s) => s.iso ?? s.name).filter(Boolean)
      : null
    return {
      key: `calendarific:${country}:${year}:${region ?? 'all'}:${idx}:${iso}`,
      date: iso,
      name: r.name,
      type: calendarificTypeToHolidayType(r.type),
      regions: states,
      source: 'calendarific',
    }
  })
}

function calendarificTypeToHolidayType(types: string[]): HolidayType {
  const lower = types.map((t) => t.toLowerCase())
  if (lower.some((t) => t.includes('national'))) return 'public'
  if (lower.some((t) => t.includes('local')))    return 'restricted'
  return 'optional'
}

// -----------------------------------------------------------------------------
// Front-door — picks the right provider.
// -----------------------------------------------------------------------------
export async function fetchExternalHolidays(opts: {
  provider: Provider
  country: string
  year: number
  region?: string
}): Promise<ImportedHoliday[]> {
  if (opts.provider === 'calendarific') return fetchFromCalendarific(opts.country, opts.year, opts.region)
  throw new Error(`Unknown provider: ${opts.provider}`)
}

// -----------------------------------------------------------------------------
// fetchJsonSafe — defensive fetch with timeout, body-text guard, and a clear
// error message when the upstream returns empty or non-JSON content. Some
// upstreams (or proxies) return 200 + empty body or an HTML error page;
// res.json() then throws "Unexpected end of JSON input" with no context.
// -----------------------------------------------------------------------------
async function fetchJsonSafe<T>(url: string, label: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  let res: Response
  try {
    res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'PayFlow/1.0' },
    })
  } catch (err) {
    clearTimeout(timeout)
    const e = err as Error
    if (e.name === 'AbortError') throw new Error(`${label} timed out after 10s`)
    throw new Error(`${label} request failed: ${e.message}`)
  }
  clearTimeout(timeout)

  if (!res.ok) {
    if (res.status === 404) return null
    const body = await res.text().catch(() => '')
    throw new Error(`${label} returned ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`)
  }

  const text = await res.text()
  if (!text || text.trim() === '') return null

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 160)}`)
  }
}
