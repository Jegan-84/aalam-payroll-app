import 'server-only'
import JSZip from 'jszip'

// =============================================================================
// Minimal XLSX builder
// =============================================================================
// We need cell highlighting in some report exports (daily timesheet grid: leave
// rows tinted rose, half-day amber, weekends grey, totals bold). Plain CSV
// can't carry styling, and we don't want a heavyweight dep just for this.
//
// XLSX is just a ZIP of XML parts. This helper writes a single-sheet workbook
// with a fixed style palette (`XlsxStyle`) that covers the cases the daily
// grid needs. Strings only — that's enough for our export shape (H:MM, "Leave",
// employee names). Extend the style table if a future report needs more.
// =============================================================================

export type XlsxStyle =
  | 'default'
  | 'header'
  | 'totals'
  | 'full_leave'
  | 'half_leave'
  | 'wfh'
  | 'weekend'

export type XlsxCell = { value: string | number; style?: XlsxStyle }
export type XlsxRow = XlsxCell[]
export type XlsxColSpec = { width: number }

export type XlsxOptions = {
  sheetName: string
  rows: XlsxRow[]
  cols?: XlsxColSpec[]
  /**
   * Freeze the top N rows and left M columns. Useful for wide grids — the
   * employee column stays visible as the user scrolls horizontally.
   */
  freeze?: { rows?: number; cols?: number }
}

export async function buildXlsx(opts: XlsxOptions): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
  zip.file('_rels/.rels', ROOT_RELS_XML)
  zip.file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS_XML)
  zip.file('xl/workbook.xml', buildWorkbookXml(opts.sheetName))
  zip.file('xl/styles.xml', STYLES_XML)
  zip.file('xl/worksheets/sheet1.xml', buildSheetXml(opts.rows, opts.cols, opts.freeze))
  return zip.generateAsync({ type: 'arraybuffer' })
}

// =============================================================================
// Helpers
// =============================================================================
function colLetter(idx: number): string {
  // 0 → A, 25 → Z, 26 → AA, ...
  let n = idx + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const STYLE_INDEX: Record<XlsxStyle, number> = {
  default: 0,
  header: 1,
  totals: 2,
  full_leave: 3,
  half_leave: 4,
  weekend: 5,
  wfh: 6,
}

function buildSheetXml(rows: XlsxRow[], cols: XlsxColSpec[] | undefined, freeze: XlsxOptions['freeze']): string {
  const colsXml = cols && cols.length > 0
    ? `<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('')}</cols>`
    : ''

  const fRows = freeze?.rows ?? 0
  const fCols = freeze?.cols ?? 0
  const sheetViewsXml = (fRows > 0 || fCols > 0)
    ? `<sheetViews><sheetView workbookViewId="0"><pane ${fCols > 0 ? `xSplit="${fCols}" ` : ''}${fRows > 0 ? `ySplit="${fRows}" ` : ''}topLeftCell="${colLetter(fCols)}${fRows + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`
    : ''

  const rowsXml = rows.map((row, rowIdx) => {
    const r = rowIdx + 1
    const cells = row.map((cell, colIdx) => {
      const ref = `${colLetter(colIdx)}${r}`
      const styleIdx = STYLE_INDEX[cell.style ?? 'default']
      const v = String(cell.value ?? '')
      return `<c r="${ref}" t="inlineStr" s="${styleIdx}"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`
    }).join('')
    return `<row r="${r}">${cells}</row>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetViewsXml}${colsXml}<sheetData>${rowsXml}</sheetData></worksheet>`
}

function buildWorkbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
}

// =============================================================================
// Static parts
// =============================================================================
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

// fonts: 0 default, 1 bold, 2 italic-grey
// fills: 0 none, 1 reserved (gray125), 2 rose, 3 amber, 4 slate, 5 header-slate, 6 sky
// cellXfs (style indices used above):
//   0 default
//   1 header (bold + header-slate fill)
//   2 totals (bold, no fill)
//   3 full_leave (bold + rose)
//   4 half_leave (amber)
//   5 weekend (italic-grey + slate)
//   6 wfh (sky fill)
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><i/><sz val="11"/><name val="Calibri"/><color rgb="FF94A3B8"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFE4E6"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE0F2FE"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
