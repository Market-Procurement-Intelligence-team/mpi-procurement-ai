/**
 * Form fields for the log in and sign up pages: a label, the input (48px tall,
 * 1.5px border) and, if something is wrong, a plain message right under it
 * that screen readers read out with the field.
 */

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react"
import { CircleAlert } from "lucide-react"

const INPUT =
  "block h-12 w-full rounded-md border-[1.5px] bg-white px-3 text-[16px] text-navy placeholder:text-muted/70 transition-shadow focus:outline-none"

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string
  /** Small text on the right of the label, e.g. "At least 8 characters" or a link. */
  aside?: ReactNode
  error?: string | null
}

function borderFor(error?: string | null) {
  return error
    ? "border-red focus:border-red focus:ring-[3px] focus:ring-red/15"
    : "border-input focus:border-orange focus:ring-[3px] focus:ring-orange/20"
}

function FieldShell({ id, label, aside, error, children }: { id: string; label: string; aside?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-navy">
          {label}
        </label>
        {aside && <div className="text-sm">{aside}</div>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-text">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, aside, error, className = "", ...rest }: FieldProps) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} aside={aside} error={error}>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${INPUT} ${borderFor(error)} ${className}`}
      />
    </FieldShell>
  )
}

/** A password box with a Show / Hide button. */
export function PasswordField({ label, aside, error, ...rest }: Omit<FieldProps, "type">) {
  const id = useId()
  const [shown, setShown] = useState(false)
  return (
    <FieldShell id={id} label={label} aside={aside} error={error}>
      <div className="relative">
        <input
          id={id}
          {...rest}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${INPUT} ${borderFor(error)} pr-20`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-2 h-9 -translate-y-1/2 rounded px-3 text-sm font-semibold text-navy hover:bg-navy-tint"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </FieldShell>
  )
}

/** A message for the whole form (not one field). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-red-tint p-3 text-[15px] font-medium text-red-text" role="alert">
      <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 8

export function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
