/** Shared helpers for the Dashboard money charts. */

export interface MonthPoint {
  key: string
  label: string
  long: string
  spent: number
  saved: number
  orders: number
}

/** Smooth curve through the points that never overshoots (monotone cubic). */
export function smooth(ys: number[], samples: number): number[] {
  const n = ys.length
  const d = ys.slice(1).map((y, k) => y - ys[k])
  const m = ys.map((_, k) => (k === 0 ? d[0] : k === n - 1 ? d[n - 2] : d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2))
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0
      m[k + 1] = 0
      continue
    }
    const a = m[k] / d[k]
    const b = m[k + 1] / d[k]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[k] = t * a * d[k]
      m[k + 1] = t * b * d[k]
    }
  }
  return Array.from({ length: samples + 1 }, (_, j) => {
    const x = (j / samples) * (n - 1)
    const k = Math.min(n - 2, Math.floor(x))
    const t = x - k
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1
    const h10 = t ** 3 - 2 * t ** 2 + t
    const h01 = -2 * t ** 3 + 3 * t ** 2
    const h11 = t ** 3 - t ** 2
    return Math.max(0, h00 * ys[k] + h10 * m[k] + h01 * ys[k + 1] + h11 * m[k + 1])
  })
}

/** ₹45k, ₹1.2L, ₹2.1Cr: short labels for chart axes. */
export function short(n: number): string {
  if (n >= 1e7) return `₹${parseFloat((n / 1e7).toFixed(2))}Cr`
  if (n >= 1e5) return `₹${parseFloat((n / 1e5).toFixed(2))}L`
  if (n >= 1e3) return `₹${Math.round(n / 1e3)}k`
  return `₹${Math.round(n)}`
}

/** Rounds up to a tidy axis value: 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeil(n: number): number {
  const p = 10 ** Math.floor(Math.log10(n))
  return ([1, 2, 2.5, 5, 10].find((f) => f * p >= n) ?? 10) * p
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`
