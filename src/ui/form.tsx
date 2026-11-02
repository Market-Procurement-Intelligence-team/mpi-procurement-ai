/**
 * Form pieces for the signed-in screens: a field label with an optional hint
 * and error, plus the shared look of boxes (48px tall, 1.5px border, orange
 * focus ring), matching the log in page.
 */

import { useId, type ReactNode } from "react"
import { CircleAlert } from "lucide-react"

export const BOX =
  "block w-full rounded-md border-[1.5px] bg-white px-3 text-[16px] text-navy placeholder:text-muted/70 transition-shadow focus:outline-none"

export function boxBorder(error?: string | null): string {
  return error
    ? "border-red focus:border-red focus:ring-[3px] focus:ring-red/15"
    : "border-input focus:border-orange focus:ring-[3px] focus:ring-orange/20"
}

export function ErrorText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-text">
      <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

export interface FieldProps {
  label: ReactNode
  /** Small text under the box. */
  hint?: ReactNode
  /** Small text on the right of the label, e.g. "Optional". */
  aside?: ReactNode
  error?: string | null
  /** Gets the box's id and the aria props that tie the label, hint and error to it. */
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode
}

export function Field({ label, hint, aside, error, children }: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-navy">
          {label}
        </label>
        {aside && <div className="text-sm text-muted">{aside}</div>}
      </div>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  )
}

/** A form-wide message (not tied to one field). */
export function Alert({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  return tone === "error" ? (
    <p className="flex items-start gap-2 rounded-md bg-red-tint p-3 text-[15px] font-medium text-red-text" role="alert">
      <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  ) : (
    <div className="flex items-start gap-2 rounded-md bg-orange-tint p-3 text-[15px] text-navy" role="status">
      {children}
    </div>
  )
}
