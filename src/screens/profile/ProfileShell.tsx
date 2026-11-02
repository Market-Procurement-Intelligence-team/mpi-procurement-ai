/**
 * The frame of every profile page: a dark header card (name, status, how
 * others see you, how complete the profile is), a section menu on wide
 * screens, the sections, and a save bar that appears once something changes.
 */

import { useEffect, useState, type ReactNode } from "react"
import { CircleCheck, Lock, RotateCcw, Save } from "lucide-react"
import Button from "../../ui/Button"

export interface ShellSection {
  id: string
  label: string
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

function CompletenessRing({ percent }: { percent: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-24 shrink-0" role="img" aria-label={`Profile ${percent}% complete`}>
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <defs>
          <linearGradient id="mpi-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f09a47" />
            <stop offset="100%" stopColor="#db4230" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#mpi-ring)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold leading-none text-white">{percent}%</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">done</span>
      </span>
    </div>
  )
}

export default function ProfileShell({
  name,
  subtitle,
  chips,
  alias,
  completeness,
  sections,
  dirty,
  saving,
  saveError,
  onSave,
  onDiscard,
  children,
}: {
  name: string
  subtitle: string
  chips?: ReactNode
  /** How the other side sees this company, e.g. "MPI Verified Buyer #2031". */
  alias?: { label: string; value: string }
  /** Share of profile details filled in, 0 to 100. Hidden when undefined. */
  completeness?: { percent: number; hint: string }
  sections: ShellSection[]
  dirty: boolean
  saving: boolean
  saveError: string | null
  onSave: () => void
  onDiscard: () => void
  children: ReactNode
}) {
  const [active, setActive] = useState(sections[0]?.id)
  const [justSaved, setJustSaved] = useState(false)

  // Highlight the section in view in the side menu.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el)
    if (!els.length || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-90px 0px -55% 0px" },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  // Show "Saved" for a moment after saving.
  const [wasSaving, setWasSaving] = useState(false)
  useEffect(() => {
    if (saving) setWasSaving(true)
    else if (wasSaving) {
      setWasSaving(false)
      if (!saveError && !dirty) {
        setJustSaved(true)
        const t = setTimeout(() => setJustSaved(false), 2500)
        return () => clearTimeout(t)
      }
    }
  }, [saving, wasSaving, saveError, dirty])

  return (
    <div className={dirty || justSaved || saveError ? "pb-28" : ""}>
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white shadow-[0_8px_30px_rgba(15,23,40,0.18)]">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-orange/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-[#2b4a7e]/40 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
            <span className="btn-gradient flex size-16 shrink-0 items-center justify-center rounded-2xl font-display text-2xl font-bold text-navy shadow-lg sm:size-20 sm:text-3xl">
              {initialsOf(name)}
            </span>
            <div className="min-w-0">
              <h1 className="text-[26px] font-bold leading-tight break-words sm:truncate sm:text-[32px]">{name}</h1>
              <p className="mt-1 text-[15px] text-white/70">{subtitle}</p>
              {chips && <div className="mt-3 flex flex-wrap gap-2">{chips}</div>}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:shrink-0">
            {alias && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">{alias.label}</p>
                <p className="mt-1 flex items-center gap-2 font-semibold">
                  <Lock size={15} className="text-orange" aria-hidden="true" />
                  {alias.value}
                </p>
              </div>
            )}
            {completeness && (
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <CompletenessRing percent={completeness.percent} />
                <p className="max-w-40 text-sm text-white/75">{completeness.hint}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* Section menu */}
        <nav aria-label="Profile sections" className="hidden xl:block">
          <ul className="sticky top-24 space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={() => setActive(s.id)}
                  aria-current={active === s.id ? "true" : undefined}
                  className={`flex min-h-10 items-center rounded-lg border-l-[3px] px-3 text-[15px] font-semibold transition-colors ${
                    active === s.id ? "border-orange bg-white text-navy shadow-sm" : "border-transparent text-muted hover:bg-white/70 hover:text-navy"
                  }`}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>

      {/* Save bar */}
      {(dirty || justSaved || saveError) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
            <p className="flex-1 text-[15px] font-semibold" aria-live="polite">
              {saveError ? (
                <span className="text-red-text">{saveError}</span>
              ) : justSaved && !dirty ? (
                <span className="inline-flex items-center gap-2 text-navy">
                  <CircleCheck size={18} className="text-orange-2" aria-hidden="true" />
                  Your changes are saved.
                </span>
              ) : (
                <span className="text-navy">You have unsaved changes.</span>
              )}
            </p>
            {dirty && (
              <>
                <Button variant="ghost" onClick={onDiscard} disabled={saving}>
                  <RotateCcw size={17} aria-hidden="true" />
                  Discard
                </Button>
                <Button onClick={onSave} busy={saving}>
                  <Save size={17} aria-hidden="true" />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** A chip for the dark header card. */
export function HeroChip({ tone = "plain", children }: { tone?: "plain" | "orange" | "warn"; children: ReactNode }) {
  const cls =
    tone === "orange"
      ? "bg-orange text-navy"
      : tone === "warn"
        ? "bg-red/90 text-white"
        : "border border-white/15 bg-white/10 text-white"
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{children}</span>
}
