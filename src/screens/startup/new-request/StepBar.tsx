import { Check } from "lucide-react"
import { STEPS, type StepIndex } from "./draft"

/**
 * The 5 steps across the top. Steps already reached can be clicked to go
 * back to them; later ones can't be skipped to.
 */
export default function StepBar({
  current,
  reached,
  onGo,
}: {
  current: StepIndex
  reached: StepIndex
  onGo: (step: StepIndex) => void
}) {
  return (
    <nav aria-label="Steps">
      {/* Phones: one line */}
      <p className="text-sm font-semibold text-muted sm:hidden">
        Step {current + 1} of {STEPS.length} · <span className="text-navy">{STEPS[current].label}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-tint sm:hidden" aria-hidden="true">
        <div className="btn-gradient h-full rounded-full transition-[width]" style={{ width: `${((current + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* Tablets and laptops */}
      <ol className="hidden items-center sm:flex">
        {STEPS.map((step, i) => {
          const index = i as StepIndex
          const done = index < current
          const active = index === current
          const canGo = index <= reached && !active
          return (
            <li key={step.id} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
              <button
                type="button"
                disabled={!canGo}
                onClick={() => onGo(index)}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2.5 rounded-md py-1 pr-2 text-left ${canGo ? "hover:bg-navy-tint" : "cursor-default"}`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    active
                      ? "bg-navy text-white ring-4 ring-orange/25"
                      : done
                        ? "bg-orange text-navy"
                        : "border-[1.5px] border-line bg-white text-muted"
                  }`}
                >
                  {done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                <span className={`whitespace-nowrap text-sm font-semibold ${active ? "text-navy" : done ? "text-navy" : "text-muted"} ${active ? "" : "max-lg:hidden"}`}>
                  {step.label}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span className={`mx-2 h-[2px] flex-1 rounded ${index < current ? "bg-orange" : "bg-line"}`} aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
