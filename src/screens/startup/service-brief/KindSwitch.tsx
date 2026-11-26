/** Goods or a service: switches between New request and New service brief. */

import { useNavigate } from "react-router"
import { motion } from "motion/react"
import { Package, Wand2 } from "lucide-react"

export default function KindSwitch({ value }: { value: "goods" | "service" }) {
  const navigate = useNavigate()
  const options = [
    { id: "goods" as const, label: "Goods", icon: Package, to: "/startup/requests/new" },
    { id: "service" as const, label: "A service", icon: Wand2, to: "/startup/requests/new?kind=service" },
  ]
  return (
    <div role="radiogroup" aria-label="What you need" className="inline-flex rounded-xl border-[1.5px] border-line bg-white p-1 shadow-sm">
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && navigate(o.to)}
            className={`relative flex min-h-10 items-center gap-2 rounded-lg px-4 text-[14.5px] font-semibold transition-colors ${on ? "text-white" : "text-navy hover:bg-navy-tint"}`}
          >
            {on && <motion.span layoutId="kind-switch" className="absolute inset-0 rounded-lg bg-navy" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
            <o.icon size={16} className={`relative ${on ? "text-orange" : "text-muted"}`} aria-hidden="true" />
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
