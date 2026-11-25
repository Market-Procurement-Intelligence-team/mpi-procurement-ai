/**
 * The right-side panel for adding or editing one item (a project, a job, a
 * certificate, a package). Navy header, scrolling body, sticky Save / Cancel.
 * Escape or a click on the dimmed page closes it.
 */

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion } from "motion/react"
import { X } from "lucide-react"
import Button from "../../ui/Button"
import { Alert } from "../../ui/form"

export default function SlideOver({
  title,
  subtitle,
  onClose,
  onSave,
  saveLabel,
  busy,
  error,
  canSave = true,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  onSave: () => void
  saveLabel: string
  busy?: boolean
  error?: string | null
  canSave?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose()
    window.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, busy])

  return createPortal(
    <>
      <motion.div className="fixed inset-0 bg-navy/45 backdrop-blur-[2px]" style={{ zIndex: 60 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose()} aria-hidden="true" />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl"
        style={{ zIndex: 70, maxWidth: 540 }}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <header className="relative overflow-hidden bg-ink px-5 py-4 text-white">
          <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-orange/25 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[21px] font-bold leading-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13.5px] text-white/70">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} disabled={busy} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="accent-line h-[3px] shrink-0" />
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave && !busy) onSave()
          }}
          noValidate
        >
          <div className="soft-panel flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>
          <footer className="flex flex-wrap items-center gap-3 border-t-[1.5px] border-line bg-white px-5 py-3">
            {error && (
              <div className="w-full">
                <Alert>{error}</Alert>
              </div>
            )}
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" busy={busy} disabled={!canSave} className="ml-auto">
              {busy ? "Saving…" : saveLabel}
            </Button>
          </footer>
        </form>
      </motion.aside>
    </>,
    document.body,
  )
}
