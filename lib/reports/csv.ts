/**
 * CSV / delimited-file helpers.
 *
 * - RFC 4180 quoting: fields containing the delimiter, quotes, or newlines are
 *   wrapped in double quotes with inner quotes doubled.
 * - Non-comma delimiters supported (ECR uses `#~#`).
 */

export type Cell = string | number | boolean | null | undefined

export function csvEscape(value: Cell, delimiter = ','): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  const needsQuote = s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')
  if (!needsQuote) return s
  return '"' + s.replace(/"/g, '""') + '"'
}

export function toCsv(
  rows: Cell[][],
  opts: { headers?: string[]; delimiter?: string; eol?: string } = {},
): string {
  const delim = opts.delimiter ?? ','
  const eol = opts.eol ?? '\r\n'
  const lines: string[] = []
  if (opts.headers) lines.push(opts.headers.map((h) => csvEscape(h, delim)).join(delim))
  for (const r of rows) lines.push(r.map((c) => csvEscape(c, delim)).join(delim))
  return lines.join(eol)
}

/**
 * ECR file — fields separated by `#~#`, lines terminated by CRLF. No header row.
 * Unlike CSV, ECR fields must not contain the delimiter; we strip it defensively.
 */
export function toEcr(rows: Cell[][]): string {
  const eol = '\r\n'
  return rows
    .map((r) =>
      r
        .map((c) => {
          if (c === null || c === undefined) return ''
          const s = String(c)
          return s.replace(/#~#/g, ' ').replace(/[\r\n]+/g, ' ')
        })
        .join('#~#'),
    )
    .join(eol)
}

/**
 * Encode a CSV/TXT string to bytes with a UTF-8 BOM (so Excel opens Indian
 * rupee / unicode content correctly). Returns the underlying ArrayBuffer so
 * callers can hand it to `new NextResponse(...)` without TS BodyInit friction.
 */
export function csvToBytes(text: string): ArrayBuffer {
  const body = new TextEncoder().encode(text)
  const out = new Uint8Array(3 + body.length)
  out[0] = 0xef; out[1] = 0xbb; out[2] = 0xbf   // UTF-8 BOM
  out.set(body, 3)
  return out.buffer as ArrayBuffer
}
