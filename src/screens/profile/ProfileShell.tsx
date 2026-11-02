/**
 * The frame of every profile page: a compact dark header (name, status, how
 * others see you, how complete the profile is), two tabs (Profile and
 * Settings), the profile sections in two columns on wide screens, and a save
 * bar that appears once something changes. Built to need little scrolling.
 */

import { Fragment, useEffect, useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { CircleCheck, Lock, RotateCcw, Save, Settings, UserRound } from "lucide-react"
import Button from "../../ui/Button"

function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

function CompletenessRing({ percent }: { percent: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: 72, height: 72 }} role="img" aria-label={`Profile ${percent}% complete`}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <defs>
          <linearGradient id="mpi-ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f09a47" />
            <stop offset="100%" stopColor="#db4230" />
          </linearGradient>
        </defs>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="url(#mpi-ring)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          style={{ transition: "stroke-dashoffset 500ms" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-white">{percent}%</span>
    </div>
  )
}

type Tab = "profile" | "settings"

export default function ProfileShell({
  name,
  subtitle,
  chips,
  alias,
  completeness,
  dirty,
  saving,
  saveError,
  onSave,
  onDiscard,
  top,
  cells,
  settings,
}: {
  name: string
  subtitle: string
  chips?: ReactNode
  /** How the other side sees this company, e.g. "MPI Verified Buyer #2031". */
  alias?: { label: string; value: string }
  /** Share of profile details filled in, 0 to 100. Hidden when undefined. */
  completeness?: { percent: number; hint: string }
  dirty: boolean
  saving: boolean
  saveError: string | null
  onSave: () => void
  onDiscard: () => void
  /** Shown above the sections, full width (e.g. the supplier's verification status). */
  top?: ReactNode
  /** The profile sections, two per row on wide screens so each row lines up. */
  cells: ReactNode[]
  settings: ReactNode
}) {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "settings" ? "settings" : "profile"
  const setTab = (next: Tab) => setParams(next === "settings" ? { tab: "settings" } : {}, { replace: true })
  const [justSaved, setJustSaved] = useState(false)

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

  const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className={dirty || justSaved || saveError ? "pb-24" : ""}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white shadow-[0_8px_30px_rgba(15,23,40,0.18)]">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-orange/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 size-72 rounded-full bg-[#2b4a7e]/40 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <span className="btn-gradient flex size-14 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-bold text-navy shadow-lg sm:size-16 sm:text-2xl">
              {initialsOf(name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="break-words text-[24px] font-bold leading-tight sm:text-[28px]">{name}</h1>
                {chips}
              </div>
              <p className="mt-1 text-[15px] text-white/70">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch lg:shrink-0">
            {alias && (
              <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">{alias.label}</p>
                <p className="mt-1 flex items-center gap-2 font-semibold">
                  <Lock size={15} className="text-orange" aria-hidden="true" />
                  {alias.value}
                </p>
              </div>
            )}
            {completeness && (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <CompletenessRing percent={completeness.percent} />
                <p className="max-w-44 text-sm leading-snug text-white/75">{completeness.hint}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Profile pages" className="relative flex gap-1 border-t border-white/10 px-3 sm:px-5">
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`relative flex min-h-12 items-center gap-2 px-4 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange/70 ${
                  on ? "text-white" : "text-white/60 hover:text-white"
                }`}
              >
                <t.icon size={17} className={on ? "text-orange" : ""} aria-hidden="true" />
                {t.label}
                {on && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t bg-orange" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
        {tab === "profile" ? (
          <div className="space-y-6">
            {top}
            <div className={`grid gap-6 [&>*]:min-w-0 ${cells.length > 1 ? "xl:grid-cols-2" : ""}`}>
              {/* Each section is its own grid item, so the two in a row get the same height. */}
              {cells.map((cell, i) => (
                <Fragment key={i}>{cell}</Fragment>
              ))}
            </div>
          </div>
        ) : (
          settings
        )}
      </div>

      {/* Save bar */}
      {(dirty || justSaved || saveError) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-white/95 backdrop-blur">
          <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
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
