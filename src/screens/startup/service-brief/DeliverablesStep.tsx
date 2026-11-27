/**
 * Brief step 2, "Deliverables & timing": what the startup gets, each with
 * "Done when"; the deadline, rounds of changes, online or at a place, skills
 * needed and reference links.
 */

import { AnimatePresence, motion } from "motion/react"
import { CalendarDays, Link2, ListChecks, Plus, Sparkles, Trash2, X } from "lucide-react"
import type { Skill } from "../../../services/data/providers"
import { Alert, BOX, boxBorder, ErrorText, Field } from "../../../ui/form"
import { Segmented, Stepper } from "../../freelancer/ui"
import { INDIAN_STATES, todayIso, type Errors } from "../new-request/draft"
import { emptyDeliverable, type ServiceDraft } from "./brief"
import { CARD, StepTitle } from "./parts"

const MAX_DELIVERABLES = 10
const MAX_SKILLS = 6
const MAX_LINKS = 5

export default function DeliverablesStep({
  draft,
  update,
  skills,
  errors,
}: {
  draft: ServiceDraft
  update: (patch: Partial<ServiceDraft>) => void
  /** Skills of the chosen category. */
  skills: Skill[]
  errors: Errors
}) {
  const missing = draft.aiReading && draft.aiReadText === draft.text ? draft.missing : []
  const setDeliverable = (key: string, patch: Partial<{ title: string; doneWhen: string }>) =>
    update({ deliverables: draft.deliverables.map((d) => (d.key === key ? { ...d, ...patch } : d)) })
  const toggleSkill = (id: string) =>
    update({ skillIds: draft.skillIds.includes(id) ? draft.skillIds.filter((s) => s !== id) : [...draft.skillIds, id].slice(0, MAX_SKILLS) })

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <Alert tone="info">
          <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Your text didn't mention:</strong> {missing.join(", ")}. Please fill these in below.
          </span>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className={CARD}>
            <StepTitle icon={ListChecks} title="Deliverables" aside={`${draft.deliverables.length} of ${MAX_DELIVERABLES}`} />
            <p className="mt-2 text-[15px] text-muted">The separate things you'll get. "Done when" says how you'll know each one is finished.</p>
            <div className="mt-4 hidden grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-2 px-3 text-[13px] font-semibold text-navy sm:grid">
              <span />
              <span>What you get</span>
              <span>
                Done when <span className="font-normal text-muted">(optional)</span>
              </span>
              <span />
            </div>
            <ol className="mt-1.5 space-y-2">
              <AnimatePresence initial={false}>
                {draft.deliverables.map((d, i) => {
                  const err = errors[`${d.key}.title`]
                  return (
                    <motion.li
                      key={d.key}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-lg border-[1.5px] border-line bg-white p-2.5"
                    >
                      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_2.25rem] items-start gap-2 sm:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_2.25rem]">
                        <span className="mt-2 flex size-7 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">{i + 1}</span>
                        <div className="min-w-0">
                          <input
                            value={d.title}
                            maxLength={200}
                            onChange={(e) => setDeliverable(d.key, { title: e.target.value })}
                            placeholder="e.g. Store live with 15 products"
                            aria-label={`Deliverable ${i + 1}: what you get`}
                            aria-invalid={err ? true : undefined}
                            className={`${BOX} ${boxBorder(err)} h-11 text-[15px]`}
                          />
                          {err && <ErrorText>{err}</ErrorText>}
                        </div>
                        <input
                          value={d.doneWhen}
                          maxLength={300}
                          onChange={(e) => setDeliverable(d.key, { doneWhen: e.target.value })}
                          placeholder="Done when… e.g. customers can order"
                          aria-label={`Deliverable ${i + 1}: done when`}
                          className={`${BOX} ${boxBorder()} col-start-2 h-11 text-[15px] sm:col-start-auto`}
                        />
                        <button
                          type="button"
                          onClick={() => update({ deliverables: draft.deliverables.filter((x) => x.key !== d.key) })}
                          className="col-start-3 row-start-1 mt-0.5 rounded-md p-2 text-muted hover:bg-red-tint hover:text-red-text sm:col-start-auto sm:row-start-auto"
                          aria-label={`Remove deliverable ${i + 1}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ol>
            {draft.deliverables.length < MAX_DELIVERABLES && (
              <button
                type="button"
                onClick={() => update({ deliverables: [...draft.deliverables, emptyDeliverable()] })}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-input bg-white/70 text-[15px] font-semibold text-navy hover:border-orange hover:bg-orange-tint/40"
              >
                <Plus size={17} aria-hidden="true" /> Add a deliverable
              </button>
            )}
            {errors.deliverables && <ErrorText>{errors.deliverables}</ErrorText>}
          </section>

          <section className={CARD}>
            <StepTitle icon={Link2} title="Reference links" aside="Optional" />
            <p className="mt-2 text-[15px] text-muted">Examples you like, your brand guide or current website. Providers see these.</p>
            <div className="mt-3 space-y-2">
              {draft.links.map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      value={l}
                      onChange={(e) => update({ links: draft.links.map((x, j) => (j === i ? e.target.value : x)) })}
                      placeholder="https://"
                      aria-label={`Link ${i + 1}`}
                      aria-invalid={errors[`link.${i}`] ? true : undefined}
                      className={`${BOX} ${boxBorder(errors[`link.${i}`])} h-11 text-[15px]`}
                    />
                    {errors[`link.${i}`] && <ErrorText>{errors[`link.${i}`]}</ErrorText>}
                  </div>
                  <button type="button" onClick={() => update({ links: draft.links.filter((_, j) => j !== i) })} className="mt-1.5 rounded-md p-2 text-muted hover:bg-navy-tint hover:text-navy" aria-label={`Remove link ${i + 1}`}>
                    <X size={17} />
                  </button>
                </div>
              ))}
              {draft.links.length < MAX_LINKS && (
                <button type="button" onClick={() => update({ links: [...draft.links, ""] })} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-[14.5px] font-semibold text-navy hover:bg-navy-tint">
                  <Plus size={16} aria-hidden="true" /> Add a link
                </button>
              )}
              <p className="text-[13px] text-muted">File uploads are coming soon.</p>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className={CARD}>
            <StepTitle icon={CalendarDays} title="Timing and place" />
            <div className="mt-4 space-y-5">
              <Field label="Deadline" error={errors.neededBy} hint="When all the work must be done.">
                {(a) => (
                  <input {...a} type="date" min={todayIso()} value={draft.neededBy} onChange={(e) => update({ neededBy: e.target.value })} className={`${BOX} ${boxBorder(errors.neededBy)} h-12 max-w-xs`} />
                )}
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-navy">Rounds of changes you want</p>
                <Stepper label="rounds of changes" value={draft.revisionRounds} min={0} max={10} onChange={(n) => update({ revisionRounds: n })} />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-navy">Where the work happens</p>
                <Segmented
                  label="Where the work happens"
                  value={draft.remote ? "online" : "place"}
                  onChange={(v) => update({ remote: v === "online" })}
                  options={[
                    { value: "online", label: "Online, anywhere in India" },
                    { value: "place", label: "At a place" },
                  ]}
                />
              </div>
              {!draft.remote && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" error={errors.deliveryCity}>
                    {(a) => <input {...a} value={draft.deliveryCity} onChange={(e) => update({ deliveryCity: e.target.value })} className={`${BOX} ${boxBorder(errors.deliveryCity)} h-12`} />}
                  </Field>
                  <Field label="State" error={errors.deliveryState}>
                    {(a) => (
                      <select {...a} value={draft.deliveryState} onChange={(e) => update({ deliveryState: e.target.value })} className={`${BOX} ${boxBorder(errors.deliveryState)} h-12`}>
                        <option value="">Choose a state</option>
                        {draft.deliveryState && !INDIAN_STATES.includes(draft.deliveryState) && <option value={draft.deliveryState}>{draft.deliveryState}</option>}
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
            <StepTitle icon={Sparkles} title="Skills needed" aside={`${draft.skillIds.length} of ${MAX_SKILLS}`} />
            <p className="mt-2 text-[15px] text-muted">MPI uses these to find the right providers.</p>
            {skills.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.map((s) => {
                  const on = draft.skillIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      disabled={!on && draft.skillIds.length >= MAX_SKILLS}
                      onClick={() => toggleSkill(s.id)}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[14px] font-semibold transition-colors disabled:opacity-50 ${
                        on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"
                      }`}
                    >
                      {on ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                      {s.name}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 text-[14px] text-muted">No skills listed for this kind of service yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
