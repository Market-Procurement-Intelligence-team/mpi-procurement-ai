/**
 * A panel that slides in from the right, for looking at something without
 * leaving the list: a provider's profile, or the shortlist. Navy header, a
 * scrolling body and an optional footer. Escape or a click on the dimmed
 * page closes it.
 */

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion } from "motion/react"
import { X } from "lucide-react"

export default function Panel({
  title,
  subtitle,
  onClose,
  width = 560,
  footer,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  width?: number
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 bg-navy/45 backdrop-blur-[2px]"
        style={{ zIndex: 60 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl"
        style={{ zIndex: 70, maxWidth: width }}
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
            <button type="button" onClick={onClose} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="accent-line h-[3px] shrink-0" />
        <div className="soft-panel min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-3 border-t-[1.5px] border-line bg-white px-5 py-3">{footer}</footer>}
      </motion.aside>
    </>,
    document.body,
  )
}
