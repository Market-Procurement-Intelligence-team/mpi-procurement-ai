/** A small on/off switch with the brand gradient when on. */

import { motion } from "motion/react"

export default function Switch({ on, busy, label, onChange }: { on: boolean; busy?: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60"
      style={{ background: on ? "linear-gradient(105deg, #f09a47, #ec8d49, #e5683a)" : "#cbd2dc" }}
    >
      <motion.span
        className="block h-5 w-5 rounded-full bg-white shadow"
        animate={{ x: on ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  )
}
