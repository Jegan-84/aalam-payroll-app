const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatInr = (n: number | null | undefined, decimals: 0 | 2 = 0): string => {
  if (n == null || Number.isNaN(n)) return '—'
  return '₹ ' + (decimals === 0 ? inr0 : inr2).format(Number(n))
}
