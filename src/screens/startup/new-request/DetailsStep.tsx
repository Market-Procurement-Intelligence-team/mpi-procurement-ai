import { useState } from "react"
import { Check, Plus, X } from "lucide-react"
import Button from "../../../ui/Button"
import { BOX, boxBorder, Field } from "../../../ui/form"
import { COMMON_CERTIFICATIONS, type Errors, type WizardDraft } from "./draft"

const CARD = "rounded-xl border-[1.5px] border-line bg-white p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)] sm:p-6"

export default function DetailsStep({
  draft,
  update,
  errors,
}: {
  draft: WizardDraft
  update: (patch: Partial<WizardDraft>) => void
  errors: Errors
}) {
  const [custom, setCustom] = useState("")
  const chosen = new Set(draft.certifications)
  const toggle = (name: string) =>
    update({
      certifications: chosen.has(name) ? draft.certifications.filter((c) => c !== name) : [...draft.certifications, name],
    })
  const addCustom = () => {
    const name = custom.trim().slice(0, 60)
    if (name && !chosen.has(name) && draft.certifications.length < 10) update({ certifications: [...draft.certifications, name] })
    setCustom("")
  }
  const extra = draft.certifications.filter((c) => !COMMON_CERTIFICATIONS.includes(c))

  return (
    <div className="space-y-6">
      <section className={CARD}>
        <h2 className="text-lg font-bold text-navy">About this request</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <Field label="Request title" hint="Suppliers see this title." error={errors.title}>
            {(a) => (
              <input
                {...a}
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                maxLength={140}
                placeholder="For example: Printed corrugated boxes for Pune warehouse"
                className={`${BOX} ${boxBorder(errors.title)} h-12`}
              />
            )}
          </Field>
          <Field label="Summary" aside="Optional" hint="Finish, colours, packing or anything else suppliers should know.">
            {(a) => (
              <textarea
                {...a}
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={4}
                maxLength={2000}
                className={`${BOX} ${boxBorder()} resize-y py-3 leading-relaxed`}
              />
            )}
          </Field>
        </div>
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-navy">Certifications needed</h2>
          <span className="text-sm text-muted">Optional</span>
        </div>
        <p className="mt-1 text-[15px] text-muted">
          Tap the ones suppliers must have. Suppliers who have them rank higher in the matches.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...COMMON_CERTIFICATIONS, ...extra].map((name) => {
            const on = chosen.has(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                aria-pressed={on}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-colors ${
                  on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"
                }`}
              >
                {on ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                {name}
                {on && !COMMON_CERTIFICATIONS.includes(name) && <X size={14} className="-mr-1 opacity-70" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex max-w-md gap-2">
          <label htmlFor="custom-cert" className="sr-only">
            Another certification
          </label>
          <input
            id="custom-cert"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCustom()
              }
            }}
            placeholder="Another one, e.g. GMP"
            maxLength={60}
            className={`${BOX} ${boxBorder()} h-11`}
          />
          <Button variant="secondary" onClick={addCustom} disabled={!custom.trim()} className="shrink-0">
            Add
          </Button>
        </div>
      </section>
    </div>
  )
}
