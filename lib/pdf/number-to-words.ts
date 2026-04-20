/**
 * Convert a positive integer (Indian numbering) to words.
 *   123456 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six"
 * Max: 99,99,99,99,999 (≈ 10 trillion). Good for Indian salary ranges.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function upTo99(n: number): string {
  if (n < 20) return ONES[n]
  return (TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')).trim()
}

function upTo999(n: number): string {
  if (n < 100) return upTo99(n)
  const h = Math.floor(n / 100)
  const rest = n % 100
  return (ONES[h] + ' Hundred' + (rest ? ' ' + upTo99(rest) : '')).trim()
}

export function numberToIndianWords(num: number): string {
  if (!Number.isFinite(num)) return ''
  const n = Math.abs(Math.trunc(num))
  if (n === 0) return 'Zero'

  const crore = Math.floor(n / 10000000)
  const lakh  = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const hundreds = n % 1000

  const parts: string[] = []
  if (crore)    parts.push(upTo999(crore) + ' Crore')
  if (lakh)     parts.push(upTo99(lakh) + ' Lakh')
  if (thousand) parts.push(upTo99(thousand) + ' Thousand')
  if (hundreds) parts.push(upTo999(hundreds))
  return parts.join(' ')
}

export function rupeesInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - whole) * 100)
  const sign = amount < 0 ? 'Minus ' : ''
  let s = sign + 'Rupees ' + numberToIndianWords(whole)
  if (paise > 0) s += ' and ' + numberToIndianWords(paise) + ' Paise'
  return s + ' Only'
}
