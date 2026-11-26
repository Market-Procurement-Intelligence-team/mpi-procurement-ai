/** Small pieces shared by the service brief steps. */

import type { LucideIcon } from "lucide-react"

export const CARD = "rounded-xl border-[1.5px] border-line bg-white soft-panel p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)] sm:p-6"

export function StepTitle({ icon: Icon, title, aside }: { icon: LucideIcon; title: string; aside?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-orange">
          <Icon size={18} aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold text-navy">{title}</h2>
      </div>
      {aside && <span className="text-sm text-muted">{aside}</span>}
    </div>
  )
}
