import { Check } from "lucide-react"
import { STEPS, type StepIndex } from "./draft"

/**
 * The steps across the top (the 5 goods steps, or the steps passed in).
 * Steps already reached can be clicked to go
 * back to them; later ones can't be skipped to.
 */
export default function StepBar<I extends number = StepIndex>({
  current,
  reached,
  onGo,
  steps = STEPS,
}: {
  current: I
  reached: I
  onGo: (step: I) => void
  steps?: readonly { id: string; label: string }[]
}) {
  return (
    <nav aria-label="Steps">
      {/* Phones: one line */}
      <p className="text-sm font-semibold text-muted sm:hidden">
        Step {current + 1} of {steps.length} · <span className="text-navy">{steps[current].label}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-tint sm:hidden" aria-hidden="true">
        <div className="btn-gradient h-full rounded-full transition-[width]" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
      </div>

      {/* Tablets and laptops */}
      <ol className="hidden items-center sm:flex">
        {steps.map((step, i) => {
          const index = i as I
          const done = index < current
          const active = index === current
          const canGo = index <= reached && !active
          return (
            <li key={step.id} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
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
              {i < steps.length - 1 && (
                <span className={`mx-2 h-[2px] flex-1 rounded ${index < current ? "bg-orange" : "bg-line"}`} aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
