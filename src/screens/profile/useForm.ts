import { useCallback, useMemo, useState } from "react"

/** Form values with a saved copy, to know what changed and to undo it. */
export function useForm<T extends object>(initial: T) {
  const [saved, setSaved] = useState<T>(initial)
  const [values, setValues] = useState<T>(initial)
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved])
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => setValues((v) => ({ ...v, [key]: value })), [])
  const discard = useCallback(() => setValues(saved), [saved])
  /** Call after a successful save (optionally with the cleaned-up values). */
  const markSaved = useCallback((next?: T) => {
    const v = next ?? values
    setSaved(v)
    setValues(v)
  }, [values])
  const reset = useCallback((next: T) => {
    setSaved(next)
    setValues(next)
  }, [])
  return { values, saved, dirty, set, discard, markSaved, reset }
}

/** "120000" → 120000, "" → null. */
export function numberOrNull(value: string): number | null {
  const cleaned = value.replace(/[,\s₹]/g, "")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function textOrNull(value: string): string | null {
  return value.trim() || null
}

export function percentFilled(values: unknown[]): number {
  if (!values.length) return 100
  const filled = values.filter((v) => (Array.isArray(v) ? v.length > 0 : typeof v === "boolean" ? true : String(v ?? "").trim() !== "")).length
  return Math.round((filled / values.length) * 100)
}

/** Same rule as the database: 2 digits, then 13 letters or digits. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/
export const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export function memberSince(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}
