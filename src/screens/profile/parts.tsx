/**
 * Building blocks shared by the startup, supplier and admin profile pages:
 * section cards, inputs, chip pickers, tag lists, option cards and a switch.
 */

import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react"
import { Check, Plus, X, type LucideIcon } from "lucide-react"
import { BOX, boxBorder, Field } from "../../ui/form"

export function ProfileSection({
  id,
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  id: string
  icon: LucideIcon
  title: string
  description?: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-orange">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id={`${id}-title`} className="text-lg font-bold leading-tight text-navy">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
        </div>
        {badge}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

/** A small label on the right of a section header, e.g. "Hidden from suppliers". */
export function Badge({ icon: Icon, tone = "navy", children }: { icon?: LucideIcon; tone?: "navy" | "orange"; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        tone === "orange" ? "bg-orange-tint text-navy" : "bg-navy-tint text-navy"
      }`}
    >
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </span>
  )
}

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "onChange" | "value"> & {
  label: string
  hint?: ReactNode
  aside?: ReactNode
  error?: string | null
  value: string
  onChange: (value: string) => void
}

export function TextInput({ label, hint, aside, error, value, onChange, className = "", ...rest }: TextProps) {
  return (
    <Field label={label} hint={hint} aside={aside} error={error}>
      {(a) => (
        <input
          {...a}
          {...rest}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${BOX} ${boxBorder(error)} h-12 read-only:bg-page read-only:text-muted ${className}`}
        />
      )}
    </Field>
  )
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "onChange" | "value"> & {
  label: string
  hint?: ReactNode
  aside?: ReactNode
  error?: string | null
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}

export function SelectInput({ label, hint, aside, error, value, onChange, options, placeholder = "Choose one", ...rest }: SelectProps) {
  const known = options.some((o) => o.value === value)
  return (
    <Field label={label} hint={hint} aside={aside} error={error}>
      {(a) => (
        <select {...a} {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={`${BOX} ${boxBorder(error)} h-12`}>
          <option value="">{placeholder}</option>
          {value && !known && <option value={value}>{value}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function TextArea({
  label,
  hint,
  aside,
  value,
  onChange,
  rows = 4,
  maxLength = 2000,
  placeholder,
}: {
  label: string
  hint?: ReactNode
  aside?: ReactNode
  value: string
  onChange: (value: string) => void
  rows?: number
  maxLength?: number
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint} aside={aside}>
      {(a) => (
        <textarea
          {...a}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`${BOX} ${boxBorder()} resize-y py-3 leading-relaxed`}
        />
      )}
    </Field>
  )
}

/** Tap to choose several from a fixed list. */
export function ChoiceChips({
  label,
  hint,
  options,
  selected,
  onChange,
}: {
  label: string
  hint?: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const on = new Set(selected)
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy">{label}</legend>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = on.has(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-colors ${
                active ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"
              }`}
            >
              {active ? <Check size={14} className="text-orange" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** A list of short free-text entries (machines, testing facilities…). */
export function TagsInput({
  label,
  hint,
  values,
  onChange,
  placeholder,
  suggestions = [],
  max = 20,
}: {
  label: string
  hint?: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  suggestions?: string[]
  max?: number
}) {
  const [draft, setDraft] = useState("")
  const add = (raw: string) => {
    const value = raw.trim().slice(0, 60)
    if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase()) && values.length < max) onChange([...values, value])
    setDraft("")
  }
  const unused = suggestions.filter((s) => !values.includes(s))
  const inputId = `tags-${label.replace(/\W+/g, "-").toLowerCase()}`
  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-semibold text-navy">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-navy px-3 text-sm font-semibold text-white">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="-mr-1 rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white"
              aria-label={`Remove ${v}`}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        {unused.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => add(s)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-line px-3 text-sm font-semibold text-navy hover:border-navy"
          >
            <Plus size={13} aria-hidden="true" />
            {s}
          </button>
        ))}
      </div>
      <div className="mt-3 flex max-w-md gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(draft)
            }
          }}
          placeholder={placeholder}
          maxLength={60}
          className={`${BOX} ${boxBorder()} h-11`}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="min-h-11 shrink-0 rounded-md border-[1.5px] border-navy px-4 text-[15px] font-bold text-navy hover:bg-navy-tint disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}

/** One choice from a few cards, e.g. turnaround priority. */
export function OptionCards<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  options: { value: T; title: string; body: string; icon: LucideIcon }[]
  value: T | ""
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy">{label}</legend>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
        {options.map((o) => {
          const active = value === o.value
          return (
            <label
              key={o.value}
              className={`relative flex cursor-pointer flex-col gap-1 rounded-lg border-[1.5px] p-4 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-orange/30 ${
                active ? "border-orange bg-orange-tint/60" : "border-line bg-white hover:border-navy"
              }`}
            >
              <input type="radio" className="sr-only" checked={active} onChange={() => onChange(o.value)} name={label} />
              <span className="flex items-center justify-between">
                <span className="font-semibold text-navy">{o.title}</span>
                <o.icon size={18} className={active ? "text-navy" : "text-muted"} aria-hidden="true" />
              </span>
              <span className="text-sm text-muted">{o.body}</span>
              {active && (
                <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-navy text-orange">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border-[1.5px] border-line p-4 hover:bg-page/60">
      <span>
        <span className="block font-semibold text-navy">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-navy peer-focus-visible:ring-[3px] peer-focus-visible:ring-orange/40 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 peer-checked:after:bg-orange"
      />
    </label>
  )
}
