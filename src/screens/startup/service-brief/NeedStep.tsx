/**
 * Brief step 1, "What you need": pick the kind of service, describe the work
 * by typing or speaking, and let the AI write the brief. On the right, the
 * brief as it stands (title and goal can be edited here; deliverables in the
 * next step).
 */

import { useId } from "react"
import { CircleCheck, Mic, Sparkles, Square, Wand2 } from "lucide-react"
import { useVoiceInput } from "../../../lib/useVoiceInput"
import type { VoiceLanguage } from "../../../lib/voiceInput"
import type { Category } from "../../../services/data/catalogue"
import type { Skill } from "../../../services/data/providers"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder, ErrorText, Field } from "../../../ui/form"
import { GRADIENT_PANEL } from "../../supplier/parts"
import { categoryIcon } from "../new-request/DescribeStep"
import type { Errors } from "../new-request/draft"
import type { ServiceDraft } from "./brief"
import { CARD, StepTitle } from "./parts"

const VOICE_LABEL: Record<string, string> = { en: "English", hi: "हिंदी" }

export default function NeedStep({
  draft,
  update,
  categories,
  skills,
  errors,
  voiceLanguage,
  setVoiceLanguage,
  aiBusy,
  aiError,
  onAiFill,
}: {
  draft: ServiceDraft
  update: (patch: Partial<ServiceDraft>) => void
  categories: Category[] | null
  skills: Skill[]
  errors: Errors
  voiceLanguage: VoiceLanguage
  setVoiceLanguage: (l: VoiceLanguage) => void
  aiBusy: boolean
  aiError: string | null
  onAiFill: () => void
}) {
  const textId = useId()
  const voice = useVoiceInput({
    language: voiceLanguage,
    onEnd: (spoken) => update({ text: draft.text.trim() ? `${draft.text.trim()} ${spoken}` : spoken }),
  })
  const fresh = !!draft.aiReading && draft.aiReadText === draft.text
  const skillNames = draft.skillIds.map((id) => skills.find((s) => s.id === id)?.name).filter(Boolean) as string[]
  const filled = draft.deliverables.filter((d) => d.title.trim())

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <section className={CARD}>
          <StepTitle icon={Wand2} title="What kind of service do you need?" />
          {categories === null ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-navy-tint" />
              ))}
            </div>
          ) : (
            <div role="radiogroup" aria-label="Kind of service" className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map((c) => {
                const Icon = categoryIcon(c.slug)
                const on = draft.categoryId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ categoryId: c.id, skillIds: draft.skillIds.filter((id) => skills.find((s) => s.id === id)?.category_id === c.id) })}
                    className={`relative flex min-h-16 items-center gap-3 rounded-lg border-[1.5px] px-3 py-2.5 text-left transition-colors ${
                      on ? "border-orange bg-orange-tint/60" : "border-line bg-white hover:border-navy hover:bg-navy-tint/60"
                    }`}
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${on ? "bg-navy text-orange" : "bg-navy-tint text-navy"}`}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug text-navy">{c.name}</span>
                    {on && <CircleCheck size={18} className="shrink-0 text-orange-2" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          )}
          {errors.categoryId && <ErrorText>{errors.categoryId}</ErrorText>}
        </section>

        <section className={CARD}>
          <StepTitle icon={Sparkles} title="Describe the work in your own words" />
          <p className="mt-2 text-[15px] text-muted">English, Hindi or Hinglish. Say what you want made or done, by when, and how you'll use it.</p>
          <label htmlFor={textId} className="sr-only">
            Describe the work
          </label>
          <textarea
            id={textId}
            value={voice.listening && voice.text ? `${draft.text}${draft.text ? " " : ""}${voice.text}` : draft.text}
            onChange={(e) => update({ text: e.target.value })}
            readOnly={voice.listening}
            rows={6}
            maxLength={4000}
            placeholder="For example: We're a millet snacks brand. We need a Shopify store with our 15 products, payments and shipping set up, live before 20 December. We'd like 2 rounds of changes."
            className={`${BOX} ${boxBorder()} mt-4 min-h-40 resize-y py-3 leading-relaxed`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-md border-[1.5px] border-line bg-white p-1">
              <Button
                variant="ghost"
                onClick={voice.toggle}
                disabled={!voice.supported || aiBusy}
                className={`min-h-9 px-3 ${voice.listening ? "bg-red-tint text-red-text hover:bg-red-tint" : ""}`}
                aria-pressed={voice.listening}
              >
                {voice.listening ? <Square size={16} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                {voice.listening ? "Stop" : "Speak"}
              </Button>
              <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
              <div role="radiogroup" aria-label="Speaking language" className="flex">
                {(["en", "hi"] as VoiceLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="radio"
                    aria-checked={voiceLanguage === lang}
                    disabled={voice.listening}
                    onClick={() => setVoiceLanguage(lang)}
                    className={`min-h-9 rounded px-2.5 text-sm font-semibold ${voiceLanguage === lang ? "bg-navy text-white" : "text-navy hover:bg-navy-tint"}`}
                  >
                    {VOICE_LABEL[lang]}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={onAiFill} busy={aiBusy} disabled={!draft.text.trim() || voice.listening} className="ml-auto">
              <Sparkles size={18} aria-hidden="true" />
              {aiBusy ? "Writing your brief…" : fresh ? "Write it again" : "Let AI write the brief"}
            </Button>
          </div>
          <div aria-live="polite" className="mt-3 space-y-3">
            {voice.listening && <p className="text-sm font-medium text-navy">Listening… speak now, then press Stop.</p>}
            {voice.error && <Alert>{voice.error}</Alert>}
            {aiError && <Alert>{aiError} You can write the brief yourself; your text is kept.</Alert>}
          </div>
        </section>
      </div>

      {/* Live brief */}
      <aside className="min-w-0 overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(21,35,61,0.08)] lg:sticky lg:top-24" style={GRADIENT_PANEL}>
        <header className="flex items-center justify-between gap-2 px-5 py-3" style={{ background: "#eef1f5", borderBottom: "1px solid #cbd2dc" }}>
          <h2 className="text-[16px] font-bold text-navy">Your brief</h2>
          {fresh ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-tint px-2.5 py-0.5 text-xs font-bold text-navy">
              <Sparkles size={12} aria-hidden="true" /> Written by AI, check it
            </span>
          ) : (
            <span className="text-xs font-semibold text-muted">You can edit everything</span>
          )}
        </header>
        <div className="space-y-4 px-5 py-5">
          <Field label="Title" error={errors.title} aside={`${draft.title.length}/120`}>
            {(a) => (
              <input {...a} value={draft.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. Shopify store for our snacks brand" className={`${BOX} ${boxBorder(errors.title)} h-12`} />
            )}
          </Field>
          <Field label="Goal" aside="Optional" hint="What you want to achieve, in a sentence or two.">
            {(a) => (
              <textarea {...a} value={draft.goal} maxLength={1000} rows={3} onChange={(e) => update({ goal: e.target.value })} className={`${BOX} ${boxBorder()} min-h-24 resize-y py-2.5`} />
            )}
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-navy">Deliverables</p>
            {filled.length ? (
              <ul className="space-y-1.5">
                {filled.slice(0, 5).map((d) => (
                  <li key={d.key} className="flex items-start gap-2 rounded-lg border border-line/70 bg-white px-3 py-2 text-[14px] text-navy">
                    <CircleCheck size={16} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{d.title}</span>
                      {d.doneWhen && <span className="block text-[12.5px] text-muted">Done when: {d.doneWhen}</span>}
                    </span>
                  </li>
                ))}
                {filled.length > 5 && <li className="text-[13px] text-muted">and {filled.length - 5} more</li>}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-input bg-white/70 px-3 py-2.5 text-[13.5px] text-muted">The AI lists them here, or you add them in the next step.</p>
            )}
          </div>
          {skillNames.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-navy">Skills needed</p>
              <div className="flex flex-wrap gap-1.5">
                {skillNames.map((n) => (
                  <span key={n} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[13px] font-semibold text-navy">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
