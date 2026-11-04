/** Pieces shared by the Schemes screens and the screens that show a request's chosen schemes. */

import { useEffect, useState } from "react"
import { Link } from "react-router"
import { motion } from "motion/react"
import { Landmark } from "lucide-react"
import { getSchemesByIds, type Scheme } from "../../services/data/schemes"

/** "Strong fit" and friends, from the 50 to 100 suggestion score. */
export function fitLabel(score: number): string {
  if (score >= 80) return "Strong fit"
  if (score >= 65) return "Good fit"
  return "Possible fit"
}

/** Small ring showing the fit score out of 100. */
export function FitRing({ score }: { score: number }) {
  const r = 17
  const c = 2 * Math.PI * r
  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center" title={`${fitLabel(score)}: ${score} out of 100`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e8ecf3" strokeWidth="4" />
        <motion.circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="url(#fitGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        />
        <defs>
          <linearGradient id="fitGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f09a47" />
            <stop offset="1" stopColor="#db4230" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-[13px] font-bold text-navy">{score}</span>
    </span>
  )
}

/**
 * The schemes saved on a request, as small links to their details.
 * `linkBase` is the area's Schemes page (e.g. "/supplier/schemes"); without
 * it the names are plain text. Shows `empty` (or nothing) when there are none.
 */
export function RequestSchemeChips({ ids, linkBase, empty }: { ids: string[]; linkBase?: string; empty?: string }) {
  const [schemes, setSchemes] = useState<Scheme[] | null>(null)
  const key = ids.join(",")
  useEffect(() => {
    let live = true
    if (!key) {
      setSchemes([])
      return
    }
    getSchemesByIds(key.split(","))
      .then((s) => live && setSchemes(s))
      .catch(() => live && setSchemes([]))
    return () => {
      live = false
    }
  }, [key])
  if (!schemes) return <span className="text-muted">Loading…</span>
  if (!schemes.length) return empty ? <span className="text-muted">{empty}</span> : null
  return (
    <span className="flex flex-wrap gap-1.5">
      {schemes.map((s) => {
        const inner = (
          <>
            <Landmark size={13} aria-hidden="true" /> {s.short_name}
          </>
        )
        const cls = "inline-flex items-center gap-1 rounded-full bg-orange-tint px-2.5 py-0.5 text-[13px] font-semibold text-navy"
        return linkBase ? (
          <Link key={s.id} to={`${linkBase}?s=${s.id}`} className={`${cls} hover:underline`}>
            {inner}
          </Link>
        ) : (
          <span key={s.id} className={cls}>
            {inner}
          </span>
        )
      })}
    </span>
  )
}
