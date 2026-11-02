import type { ReactNode } from "react"
import { BadgeCheck, Lock, Pencil, Sparkles, Users } from "lucide-react"
import type { Category } from "../../../services/data/catalogue"
import { formatDate, formatRupees, toNumber, type StepIndex, type WizardDraft } from "./draft"

function Section({ title, step, onEdit, children }: { title: string; step: StepIndex; onEdit: (step: StepIndex) => void; children: ReactNode }) {
  return (
    <section className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold uppercase tracking-wide text-muted">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-navy hover:bg-navy-tint"
          aria-label={`Edit ${title.toLowerCase()}`}
        >
          <Pencil size={15} aria-hidden="true" />
          Edit
        </button>
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-1.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-[15px] font-medium text-navy">{children}</dd>
    </div>
  )
}

const NEXT = [
  { icon: Sparkles, title: "AI finds suppliers", body: "MPI's AI looks for verified suppliers that fit your items, date and place." },
  { icon: BadgeCheck, title: "MPI checks every match", body: "The MPI team approves each supplier before they see your request." },
  { icon: Users, title: "You get price offers", body: "Approved suppliers send offers. You compare them and choose." },
]

export default function ReviewStep({
  draft,
  categories,
  onEdit,
}: {
  draft: WizardDraft
  categories: Category[] | null
  onEdit: (step: StepIndex) => void
}) {
  const category = categories?.find((c) => c.id === draft.categoryId)
  const min = toNumber(draft.budgetMin)
  const max = toNumber(draft.budgetMax)
  const budget =
    min != null && max != null
      ? `${formatRupees(draft.budgetMin)} to ${formatRupees(draft.budgetMax)}`
      : min != null
        ? `From ${formatRupees(draft.budgetMin)}`
        : max != null
          ? `Up to ${formatRupees(draft.budgetMax)}`
          : "Not given"

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-start">
      <div className="overflow-hidden rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
        <div className="accent-line h-1" />
        <div className="px-5 pt-5 sm:px-6">
          <p className="text-sm font-semibold text-muted">{category?.name ?? "No group chosen"}</p>
          <h2 className="mt-1 text-2xl font-bold text-navy">{draft.title.trim() || "Untitled request"}</h2>
          {draft.description.trim() && <p className="mt-2 whitespace-pre-line text-[15px] text-muted">{draft.description.trim()}</p>}
        </div>

        <div className="divide-y divide-line">
          <Section title="Items" step={1} onEdit={onEdit}>
            <ul className="divide-y divide-line rounded-lg border-[1.5px] border-line">
              {draft.items.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-4 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-navy">{item.description}</span>
                    {item.itemName && item.itemName !== item.description && (
                      <span className="block text-xs text-muted">Catalogue: {item.itemName}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-navy">
                    {toNumber(item.quantity)?.toLocaleString("en-IN")} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Details" step={2} onEdit={onEdit}>
            <dl>
              <Row label="Certifications">
                {draft.certifications.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {draft.certifications.map((c) => (
                      <span key={c} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-sm font-semibold">
                        {c}
                      </span>
                    ))}
                  </span>
                ) : (
                  "None needed"
                )}
              </Row>
            </dl>
          </Section>

          <Section title="Delivery and budget" step={3} onEdit={onEdit}>
            <dl>
              <Row label="Needed by">{formatDate(draft.neededBy)}</Row>
              <Row label="Delivery place">
                {draft.remote ? "Done online, no delivery place" : [draft.deliveryCity.trim(), draft.deliveryState].filter(Boolean).join(", ")}
              </Row>
              <Row label="Budget">
                <span className="inline-flex items-center gap-2">
                  {budget}
                  {(min != null || max != null) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-tint px-2 py-0.5 text-xs font-semibold">
                      <Lock size={12} aria-hidden="true" />
                      Private
                    </span>
                  )}
                </span>
              </Row>
            </dl>
          </Section>

          {draft.text.trim() && (
            <section className="px-5 py-5 sm:px-6">
              <h3 className="mb-2 text-[15px] font-bold uppercase tracking-wide text-muted">Your own words</h3>
              <p className="whitespace-pre-line rounded-lg bg-page p-3 text-[15px] text-navy">{draft.text.trim()}</p>
              <p className="mt-2 text-xs text-muted">Kept with the request for the MPI team. Suppliers don't see this.</p>
            </section>
          )}
        </div>
      </div>

      <aside className="relative overflow-hidden rounded-xl bg-ink p-6 text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-orange/20 blur-3xl" aria-hidden="true" />
        <h2 className="relative text-xl font-bold">What happens next</h2>
        <ol className="relative mt-5 space-y-5">
          {NEXT.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-orange">
                <step.icon size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold">
                  {i + 1}. {step.title}
                </span>
                <span className="block text-sm leading-relaxed text-white/75">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
