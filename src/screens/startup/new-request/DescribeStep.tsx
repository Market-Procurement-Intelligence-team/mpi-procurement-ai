import { useId } from "react"
import {
  BriefcaseBusiness,
  ChevronRight,
  Code,
  Factory,
  Megaphone,
  Mic,
  Package,
  Rocket,
  Scale,
  Sparkles,
  Square,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useVoiceInput } from "../../../lib/useVoiceInput"
import type { VoiceLanguage } from "../../../lib/voiceInput"
import type { Category } from "../../../services/data/catalogue"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import type { WizardDraft } from "./draft"

const ICONS: Record<string, LucideIcon> = {
  "packaging-and-printing": Package,
  "fabrication-and-hardware": Factory,
  "prototyping-and-product-development": Wrench,
  "it-and-digital-services": Code,
  "compliance-and-legal-support": Scale,
  "logistics-and-operations": Truck,
  "marketing-and-sales-support": Megaphone,
  "business-and-finance-services": BriefcaseBusiness,
  "specialized-startup-support": Rocket,
}

export function categoryIcon(slug: string | undefined): LucideIcon {
  return (slug && ICONS[slug]) || Package
}

const VOICE_CHOICES: VoiceLanguage[] = ["en", "hi"]
const VOICE_LABEL: Record<string, string> = { en: "English", hi: "हिंदी" }

export default function DescribeStep({
  draft,
  update,
  categories,
  voiceLanguage,
  setVoiceLanguage,
  aiBusy,
  aiError,
  onAiFill,
  onPickCategory,
}: {
  draft: WizardDraft
  update: (patch: Partial<WizardDraft>) => void
  categories: Category[] | null
  voiceLanguage: VoiceLanguage
  setVoiceLanguage: (language: VoiceLanguage) => void
  aiBusy: boolean
  aiError: string | null
  onAiFill: () => void
  onPickCategory: (categoryId: string) => void
}) {
  const textId = useId()
  const voice = useVoiceInput({
    language: voiceLanguage,
    onEnd: (spoken) => update({ text: draft.text.trim() ? `${draft.text.trim()} ${spoken}` : spoken }),
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
      {/* Free text and voice */}
      <section className="rounded-xl border-[1.5px] border-line bg-white p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)] sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-orange-tint text-navy">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-navy">
            <label htmlFor={textId}>Describe what you need</label>
          </h2>
        </div>
        <p className="mt-2 text-[15px] text-muted">
          Write or say it in your own words, in English, Hindi or Hinglish. The AI fills in the form, and you check
          everything before anything is sent.
        </p>

        <textarea
          id={textId}
          value={voice.listening && voice.text ? `${draft.text}${draft.text ? " " : ""}${voice.text}` : draft.text}
          onChange={(e) => update({ text: e.target.value })}
          readOnly={voice.listening}
          rows={7}
          maxLength={4000}
          placeholder="For example: 2,000 printed corrugated boxes, 10 x 8 x 4 inches, with our logo in 2 colours. Deliver to our Pune warehouse by 15 December."
          className={`${BOX} ${boxBorder()} mt-4 min-h-44 resize-y py-3 leading-relaxed`}
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
              {VOICE_CHOICES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={voiceLanguage === lang}
                  disabled={voice.listening}
                  onClick={() => setVoiceLanguage(lang)}
                  className={`min-h-9 rounded px-2.5 text-sm font-semibold ${
                    voiceLanguage === lang ? "bg-navy text-white" : "text-navy hover:bg-navy-tint"
                  }`}
                >
                  {VOICE_LABEL[lang]}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={onAiFill} busy={aiBusy} disabled={!draft.text.trim() || voice.listening} className="ml-auto">
            <Sparkles size={18} aria-hidden="true" />
            {aiBusy ? "Reading your request…" : "Let AI fill the form"}
          </Button>
        </div>

        <div aria-live="polite" className="mt-3 space-y-3">
          {voice.listening && <p className="text-sm font-medium text-navy">Listening… speak now, then press Stop.</p>}
          {!voice.supported && (
            <p className="text-sm text-muted">This browser can't listen. Please type instead, or use Chrome, Edge or Safari.</p>
          )}
          {voice.error && <Alert>{voice.error}</Alert>}
          {aiError && (
            <Alert>
              {aiError} You can press Next and fill in the steps yourself; your text is kept.
            </Alert>
          )}
          {draft.aiReading && draft.aiReadText === draft.text && !aiBusy && (
            <Alert tone="info">
              <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              The AI has filled the form from this text. Press Next to check it.
            </Alert>
          )}
        </div>
      </section>

      {/* Catalogue */}
      <section className="rounded-xl border-[1.5px] border-line bg-white p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)] sm:p-6">
        <h2 className="text-lg font-bold text-navy">Or choose from the catalogue</h2>
        <p className="mt-1 text-[15px] text-muted">Pick a group, then choose the items in the next step.</p>
        {categories === null ? (
          <ul className="mt-4 space-y-2" aria-label="Loading groups">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-14 animate-pulse rounded-lg bg-navy-tint" />
            ))}
          </ul>
        ) : (
          <ul className="mt-4 space-y-2">
            {categories.map((category) => {
              const Icon = categoryIcon(category.slug)
              const selected = draft.categoryId === category.id
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => onPickCategory(category.id)}
                    aria-pressed={selected}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-lg border-[1.5px] px-3 py-2 text-left transition-colors ${
                      selected ? "border-orange bg-orange-tint" : "border-line hover:border-navy hover:bg-navy-tint"
                    }`}
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${selected ? "bg-white" : "bg-navy-tint"} text-navy`}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold text-navy">{category.name}</span>
                      <span className="block text-xs text-muted">{category.is_tangible ? "Goods" : "Services"}</span>
                    </span>
                    <ChevronRight size={18} className="text-muted" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
