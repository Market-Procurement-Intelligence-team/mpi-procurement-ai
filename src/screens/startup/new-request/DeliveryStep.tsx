import { CalendarDays, Lock, MapPin, Wallet } from "lucide-react"
import { Alert, BOX, boxBorder, Field } from "../../../ui/form"
import { INDIAN_STATES, todayIso, type Errors, type WizardDraft } from "./draft"

const CARD = "rounded-xl border-[1.5px] border-line bg-white p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)] sm:p-6"

function CardTitle({ icon: Icon, children }: { icon: typeof MapPin; children: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-9 items-center justify-center rounded-lg bg-navy-tint text-navy">
        <Icon size={18} aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold text-navy">{children}</h2>
    </div>
  )
}

export default function DeliveryStep({
  draft,
  update,
  errors,
  isService,
}: {
  draft: WizardDraft
  update: (patch: Partial<WizardDraft>) => void
  errors: Errors
  /** The chosen group is a service, so "can be done online" is offered. */
  isService: boolean
}) {
  const missing = draft.aiReading && draft.aiReadText === draft.text ? draft.missing : []

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <Alert tone="info">
          <span>
            <strong className="font-semibold">Your text didn't mention:</strong> {missing.join(", ")}. Please fill these in below.
          </span>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={CARD}>
          <CardTitle icon={CalendarDays}>When and where</CardTitle>
          <div className="mt-4 space-y-5">
            <Field label="Needed by" error={errors.neededBy} hint="The date it must reach you, or the work must be done.">
              {(a) => (
                <input
                  {...a}
                  type="date"
                  min={todayIso()}
                  value={draft.neededBy}
                  onChange={(e) => update({ neededBy: e.target.value })}
                  className={`${BOX} ${boxBorder(errors.neededBy)} h-12 max-w-xs`}
                />
              )}
            </Field>

            {(isService || draft.remote) && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-line p-3 hover:bg-navy-tint/50">
                <input
                  type="checkbox"
                  checked={draft.remote}
                  onChange={(e) => update({ remote: e.target.checked })}
                  className="mt-0.5 size-5 accent-navy"
                />
                <span>
                  <span className="block text-[15px] font-semibold text-navy">This work can be done online</span>
                  <span className="block text-sm text-muted">No delivery place needed. Suppliers anywhere in India can take it.</span>
                </span>
              </label>
            )}

            {!draft.remote && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Delivery city" error={errors.deliveryCity}>
                  {(a) => (
                    <input
                      {...a}
                      value={draft.deliveryCity}
                      onChange={(e) => update({ deliveryCity: e.target.value })}
                      maxLength={80}
                      autoComplete="address-level2"
                      placeholder="For example: Pune"
                      className={`${BOX} ${boxBorder(errors.deliveryCity)} h-12`}
                    />
                  )}
                </Field>
                <Field label="State" error={errors.deliveryState}>
                  {(a) => (
                    <select
                      {...a}
                      value={draft.deliveryState}
                      onChange={(e) => update({ deliveryState: e.target.value })}
                      className={`${BOX} ${boxBorder(errors.deliveryState)} h-12`}
                    >
                      <option value="">Choose a state</option>
                      {/* Keep a state the AI wrote that isn't in the list. */}
                      {draft.deliveryState && !INDIAN_STATES.includes(draft.deliveryState) && (
                        <option value={draft.deliveryState}>{draft.deliveryState}</option>
                      )}
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            )}
          </div>
        </section>

        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle icon={Wallet}>Your budget</CardTitle>
            <span className="text-sm text-muted">Optional</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="From (₹)" error={errors.budgetMin}>
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  value={draft.budgetMin}
                  onChange={(e) => update({ budgetMin: e.target.value.replace(/[^\d,]/g, "") })}
                  placeholder="1,00,000"
                  className={`${BOX} ${boxBorder(errors.budgetMin)} h-12 tabular-nums`}
                />
              )}
            </Field>
            <Field label="Up to (₹)" error={errors.budgetMax}>
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  value={draft.budgetMax}
                  onChange={(e) => update({ budgetMax: e.target.value.replace(/[^\d,]/g, "") })}
                  placeholder="1,50,000"
                  className={`${BOX} ${boxBorder(errors.budgetMax)} h-12 tabular-nums`}
                />
              )}
            </Field>
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-lg bg-navy p-4 text-white">
            <Lock size={20} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
            <p className="text-[15px] leading-relaxed">
              <strong className="font-semibold">Private to you.</strong> Suppliers never see your budget. Only you and the
              MPI team can, and it helps when you compare price offers.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
