/**
 * Small shared pieces for the freelancer screens: the section panel (MPI
 * grey-to-peach gradient with the brand border), segmented choices, a number
 * stepper, the "Only MPI sees these" box, an editable list (included / not
 * included), and an expandable row.
 */

import { useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ChevronDown, CircleCheck, CircleX, Lock, Minus, Plus, X, type LucideIcon } from "lucide-react"
import { BOX, boxBorder } from "../../ui/form"
import { GRADIENT_PANEL } from "../supplier/parts"

/** One builder section: grey header with navy title, gradient body. */
export function SectionPanel({
  icon: Icon,
  title,
  subtitle,
  aside,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)]" style={GRADIENT_PANEL} aria-label={title}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6" style={{ background: "#eef1f5", borderBottom: "1px solid #cbd2dc" }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-orange">
            <Icon size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold leading-tight text-navy">{title}</h2>
            {subtitle && <p className="text-[13.5px] text-muted">{subtitle}</p>}
          </div>
        </div>
        {aside}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

/** A white tile inside a section. */
export function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line/70 bg-white p-4 ${className}`}>{children}</div>
}

/** Pick one of a few options, shown side by side. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  size?: "sm" | "md"
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border-[1.5px] border-line bg-white p-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative rounded-md font-semibold transition-colors ${size === "sm" ? "min-h-8 px-2.5 text-[12.5px]" : "min-h-10 px-3.5 text-[14px]"} ${
              on ? "text-white" : "text-navy hover:bg-navy-tint"
            }`}
          >
            {on && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-md bg-navy" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A labelled group with a small title, for fields that are not plain inputs. */
export function Group({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-navy">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function Stepper({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit?: string }) {
  return (
    <div className="inline-flex h-12 items-center rounded-md border-[1.5px] border-input bg-white" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="flex h-full w-11 items-center justify-center text-navy hover:bg-navy-tint disabled:opacity-40" aria-label={`Less ${label}`}>
        <Minus size={16} />
      </button>
      <span className="min-w-20 text-center text-[15px] font-bold text-navy" aria-live="polite">
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="flex h-full w-11 items-center justify-center text-navy hover:bg-navy-tint disabled:opacity-40" aria-label={`More ${label}`}>
        <Plus size={16} />
      </button>
    </div>
  )
}

/** Fields only the freelancer and MPI can see. */
export function PrivateBox({ title = "Only MPI sees these", note, children }: { title?: string; note?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border-[1.5px] border-dashed border-input bg-white/70 p-4">
      <p className="flex items-center gap-2 text-[14.5px] font-bold text-navy">
        <Lock size={16} className="text-orange-2" aria-hidden="true" />
        {title}
      </p>
      {note && <p className="mt-0.5 text-[13px] text-muted">{note}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  )
}

/** Small lock label next to a private value. */
export function PrivateTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy-tint px-2 py-0.5 text-[11.5px] font-semibold text-navy">
      <Lock size={11} aria-hidden="true" /> Only MPI
    </span>
  )
}

/** A short list of lines, e.g. what a package includes. */
export function ListEditor({
  label,
  values,
  onChange,
  tone,
  placeholder,
  max = 12,
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  tone: "in" | "out"
  placeholder: string
  max?: number
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim().slice(0, 160)
    if (v && values.length < max) onChange([...values, v])
    setDraft("")
  }
  const Icon = tone === "in" ? CircleCheck : CircleX
  return (
    <div>
      <p className="mb-1.5 flex items-center justify-between text-sm font-semibold text-navy">
        {label}
        <span className="text-[12.5px] font-medium text-muted">{values.length} added</span>
      </p>
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {values.map((v, i) => (
            <motion.li
              key={`${v}-${i}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-md border border-line/70 bg-white px-3 py-2 text-[14px] text-navy"
            >
              <Icon size={17} className={`mt-0.5 shrink-0 ${tone === "in" ? "text-[#047857]" : "text-red-text"}`} aria-hidden="true" />
              <span className="flex-1">{v}</span>
              <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="rounded p-0.5 text-muted hover:bg-navy-tint hover:text-navy" aria-label={`Remove ${v}`}>
                <X size={15} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          maxLength={160}
          aria-label={`Add to ${label}`}
          className={`${BOX} ${boxBorder()} h-11`}
        />
        <button type="button" onClick={add} disabled={!draft.trim()} className="min-h-11 shrink-0 rounded-md border-[1.5px] border-navy px-4 text-[14.5px] font-bold text-navy hover:bg-navy-tint disabled:opacity-50">
          Add
        </button>
      </div>
    </div>
  )
}

/** A row that opens smoothly to show more. */
export function ExpandRow({
  head,
  children,
  actions,
  defaultOpen = false,
}: {
  head: ReactNode
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`rounded-xl border-[1.5px] bg-white transition-colors ${open ? "border-orange/70" : "border-line/70 hover:border-input"}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 text-left" style={{ flexBasis: "16rem" }}>
          {head}
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
          <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-md p-1.5 text-muted hover:bg-navy-tint hover:text-navy" aria-label={open ? "Show less" : "Show more"}>
            <motion.span animate={{ rotate: open ? 180 : 0 }} className="block">
              <ChevronDown size={18} />
            </motion.span>
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 32 }} className="overflow-hidden">
            <div className="border-t border-line/70 px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** A dashed "+ Add" button at the end of a list. */
export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-input bg-white/60 text-[14.5px] font-bold text-navy transition-colors hover:border-orange hover:bg-orange-tint/40"
    >
      <Plus size={17} aria-hidden="true" />
      {children}
    </button>
  )
}

/** An empty list, with one line of help. */
export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-5 text-center text-[14.5px] text-muted">{children}</p>
}

/** "Edit" and "Remove" (asks first) for a list row. */
export function RowActions({ onEdit, onRemove, name }: { onEdit: () => void; onRemove: () => Promise<void>; name: string }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (asking)
    return (
      <span className="flex items-center gap-1">
        <span className="hidden text-[13px] font-semibold text-red-text sm:inline">Remove?</span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onRemove()
            } finally {
              setBusy(false)
              setAsking(false)
            }
          }}
          className="rounded-md bg-red px-2.5 py-1 text-[13px] font-bold text-white hover:bg-red-text disabled:opacity-60"
        >
          {busy ? "Removing…" : "Yes"}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="rounded-md px-2 py-1 text-[13px] font-semibold text-navy hover:bg-navy-tint">
          No
        </button>
      </span>
    )
  return (
    <span className="flex items-center gap-0.5">
      <button type="button" onClick={onEdit} className="rounded-md px-2.5 py-1 text-[13px] font-bold text-navy hover:bg-navy-tint" aria-label={`Edit ${name}`}>
        Edit
      </button>
      <button type="button" onClick={() => setAsking(true)} className="rounded-md px-2.5 py-1 text-[13px] font-semibold text-muted hover:bg-red-tint hover:text-red-text" aria-label={`Remove ${name}`}>
        Remove
      </button>
    </span>
  )
}
