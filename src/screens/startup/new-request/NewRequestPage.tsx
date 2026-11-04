/**
 * New request, in 5 steps with Back and Next:
 *   1 Describe (type or speak, then the AI fills the form; or pick a catalogue group)
 *   2 Items and quantities
 *   3 Title, summary and certifications
 *   4 Needed-by date, delivery place and the private budget
 *   5 Review, then Send to MPI
 * It can be saved as a draft from any step. Going back never loses anything.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ArrowLeft, ArrowRight, BadgeCheck, CircleCheck, Save, Send, Sparkles } from "lucide-react"
import { useMe } from "../../../app/session"
import type { VoiceLanguage } from "../../../lib/voiceInput"
import { readRequirement } from "../../../services/data/ai"
import { listCategories, listItems, type CatalogueItem, type Category } from "../../../services/data/catalogue"
import { createRequest, getRequestDetail, replaceLines, sendRequest, updateRequest, type RequestInput } from "../../../services/data/requests"
import Button from "../../../ui/Button"
import { Alert } from "../../../ui/form"
import DeliveryStep from "./DeliveryStep"
import DescribeStep from "./DescribeStep"
import DetailsStep from "./DetailsStep"
import {
  applyAiReading,
  clearSaved,
  emptyDraft,
  emptyItem,
  errorsFor,
  fromRequest,
  loadSaved,
  STEPS,
  storeSaved,
  toRequestInput,
  type Errors,
  type StepIndex,
  type WizardDraft,
} from "./draft"
import ItemsStep from "./ItemsStep"
import ReviewStep from "./ReviewStep"
import StepBar from "./StepBar"

const MY_REQUESTS = "/startup/requests"

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/** The request columns updateRequest takes, from the same input createRequest takes. */
function toFields(input: RequestInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    requirement_text: input.requirementText ?? null,
    input_language: input.inputLanguage ?? null,
    ai_extracted: input.aiExtracted ?? null,
    required_certifications: input.requiredCertifications ?? [],
    scheme_ids: input.schemeIds ?? [],
    category_id: input.categoryId ?? null,
    source: input.source ?? "catalogue",
    needed_by: input.neededBy ?? null,
    delivery_city: input.deliveryCity ?? null,
    delivery_state: input.deliveryState ?? null,
    budget_min: input.budgetMin ?? null,
    budget_max: input.budgetMax ?? null,
  }
}

export default function NewRequestPage() {
  const me = useMe()
  const [params] = useSearchParams()
  const draftId = params.get("draft")
  const initial = useRef(loadSaved())
  const [draft, setDraft] = useState<WizardDraft>(initial.current?.draft ?? emptyDraft())
  const [step, setStep] = useState<StepIndex>(initial.current?.step ?? 0)
  const [reached, setReached] = useState<StepIndex>(initial.current?.step ?? 0)
  const [requestId, setRequestId] = useState<string | null>(initial.current?.requestId ?? null)
  const [errors, setErrors] = useState<Errors>({})
  const [stepError, setStepError] = useState<string | null>(null)

  const [categories, setCategories] = useState<Category[] | null>(null)
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, CatalogueItem[]>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>("en")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiFailedText, setAiFailedText] = useState<string | null>(null)

  const [saving, setSaving] = useState<"draft" | "send" | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [sent, setSent] = useState<{ title: string } | null>(null)

  const top = useRef<HTMLDivElement>(null)
  const [opening, setOpening] = useState(false)
  // Shown when the page picks up a request left half-way in this tab.
  const [resumed, setResumed] = useState(() => {
    const d = initial.current?.draft
    return !draftId && !!d && (d.text.trim() !== "" || d.items.length > 0 || d.title.trim() !== "")
  })

  // "Continue" on a draft in My requests opens it here.
  useEffect(() => {
    if (!draftId || draftId === initial.current?.requestId) return
    let alive = true
    setOpening(true)
    getRequestDetail(draftId)
      .then(({ request, lines }) => {
        if (!alive) return
        if (request.status !== "draft") {
          setLoadError("This request has already been sent, so it can't be changed here.")
          return
        }
        setDraft(fromRequest(request, lines))
        setRequestId(request.id)
        setStep(1)
        setReached(4)
      })
      .catch((err) => alive && setLoadError(messageOf(err, "Couldn't open this draft.")))
      .finally(() => alive && setOpening(false))
    return () => {
      alive = false
    }
  }, [draftId])

  useEffect(() => {
    document.title = "New request · MPI"
  }, [])

  // Keep progress through a page refresh.
  useEffect(() => {
    if (!sent) storeSaved({ draft, step, requestId })
  }, [draft, step, requestId, sent])

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => {
        setCategories([])
        setLoadError(messageOf(err, "Couldn't load the catalogue."))
      })
  }, [])

  // Load the chosen group's items once.
  const categoryId = draft.categoryId
  useEffect(() => {
    if (!categoryId || itemsByCategory[categoryId]) return
    listItems(categoryId)
      .then((items) => setItemsByCategory((all) => ({ ...all, [categoryId]: items })))
      .catch(() => setItemsByCategory((all) => ({ ...all, [categoryId]: [] })))
  }, [categoryId, itemsByCategory])

  const update = useCallback((patch: Partial<WizardDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSavedNote(null)
  }, [])

  const go = useCallback((next: StepIndex) => {
    setResumed(false)
    setStep(next)
    setReached((r) => (next > r ? next : r))
    setErrors({})
    setStepError(null)
    setSaveError(null)
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // Clear an error as soon as its field is fixed.
  useEffect(() => {
    if (!Object.keys(errors).length || step < 1 || step > 3) return
    const now = errorsFor(step, draft)
    const kept = Object.fromEntries(Object.entries(errors).filter(([k]) => now[k]))
    if (Object.keys(kept).length === Object.keys(errors).length) return
    setErrors(kept)
    if (!Object.keys(kept).length) setStepError(null)
  }, [draft, step, errors])

  const toItemsStep = (d: WizardDraft) => {
    if (!d.items.length) setDraft({ ...d, items: [emptyItem()] })
    go(1)
  }

  const aiFill = async () => {
    const text = draft.text.trim()
    if (!text) return
    setAiBusy(true)
    setAiError(null)
    try {
      const reading = await readRequirement(text)
      const next = applyAiReading(draft, reading)
      setDraft(next)
      setAiFailedText(null)
      toItemsStep(next)
    } catch (err) {
      setAiError(messageOf(err, "The AI couldn't read this right now."))
      setAiFailedText(draft.text)
    } finally {
      setAiBusy(false)
    }
  }

  const pickCategory = (id: string) => {
    const next = { ...draft, categoryId: id }
    setDraft(next)
    toItemsStep(next)
  }

  const showErrors = (found: Errors) => {
    setErrors(found)
    setStepError("Please fix the highlighted boxes.")
    requestAnimationFrame(() => {
      const first = document.querySelector<HTMLElement>("[aria-invalid='true']")
      first?.focus({ preventScroll: true })
      first?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  const next = () => {
    if (step === 0) {
      const text = draft.text.trim()
      const unread = text && draft.text !== draft.aiReadText
      // Read new text with the AI, unless it just failed on this same text.
      if (unread && draft.text !== aiFailedText) return void aiFill()
      if (!text && !draft.categoryId && !draft.items.length) {
        setStepError("Describe what you need, or choose a group from the catalogue.")
        return
      }
      return toItemsStep(draft)
    }
    if (step >= 1 && step <= 3) {
      const found = errorsFor(step, draft)
      if (Object.keys(found).length) return showErrors(found)
      go((step + 1) as StepIndex)
    }
  }

  const back = () => step > 0 && go((step - 1) as StepIndex)

  const canSaveDraft = draft.text.trim() !== "" || draft.items.some((i) => i.description.trim()) || draft.title.trim() !== ""

  const save = async (send: boolean) => {
    if (send) {
      for (const s of [1, 2, 3] as StepIndex[]) {
        const found = errorsFor(s, draft)
        if (Object.keys(found).length) {
          go(s)
          requestAnimationFrame(() => showErrors(found))
          return
        }
      }
    }
    setSaving(send ? "send" : "draft")
    setSaveError(null)
    try {
      const input = toRequestInput(draft)
      let id = requestId
      if (id) {
        await updateRequest(id, toFields(input))
        await replaceLines(id, input.lines)
        if (send) await sendRequest(id)
      } else {
        const created = await createRequest(me.organisation.id, me.userId, input, send)
        id = created.id
        setRequestId(id)
      }
      if (send) {
        clearSaved()
        setSent({ title: input.title })
        top.current?.scrollIntoView({ block: "start" })
      } else {
        setSavedNote("Saved as a draft. You can find it in My requests and finish it later.")
      }
    } catch (err) {
      setSaveError(messageOf(err, send ? "Couldn't send your request. Please try again." : "Couldn't save the draft. Please try again."))
    } finally {
      setSaving(null)
    }
  }

  const startAgain = () => {
    clearSaved()
    setDraft(emptyDraft())
    setRequestId(null)
    setSent(null)
    setStep(0)
    setReached(0)
    setAiError(null)
    setAiFailedText(null)
    setSavedNote(null)
    setResumed(false)
    setErrors({})
    setStepError(null)
  }

  if (sent) {
    return (
      <div ref={top} className="mx-auto max-w-2xl py-6 sm:py-10">
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-line bg-white soft-panel text-center shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
          <div className="accent-line h-1" />
          <div className="px-6 py-10 sm:px-10">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-orange-tint text-navy">
              <CircleCheck size={34} aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-[28px] font-bold leading-tight text-navy">Request sent to MPI</h1>
            <p className="mt-2 text-lg font-semibold text-navy">{sent.title}</p>
            <ul className="mx-auto mt-6 max-w-md space-y-3 text-left text-[15px] text-navy">
              <li className="flex gap-3">
                <Sparkles size={20} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
                MPI's AI is now looking for verified suppliers that fit.
              </li>
              <li className="flex gap-3">
                <BadgeCheck size={20} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
                The MPI team checks every match. You'll get a notification when price offers arrive.
              </li>
            </ul>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={MY_REQUESTS} className="btn-gradient inline-flex min-h-11 items-center justify-center rounded-md px-5 font-bold text-navy shadow-sm hover:brightness-95">
                Go to My requests
              </Link>
              <Button variant="secondary" onClick={startAgain}>
                Make another request
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isService = categories?.find((c) => c.id === draft.categoryId)?.is_tangible === false
  const nextLabel =
    step === 0 && draft.text.trim() && draft.text !== draft.aiReadText && draft.text !== aiFailedText ? "Let AI fill it" : "Next"

  return (
    <div ref={top} className="scroll-mt-24 pb-28">
      <div className="mb-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link to={MY_REQUESTS} className="font-medium hover:text-navy hover:underline">
            My requests
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="font-semibold text-navy">New request</span>
        </nav>
        <h1 className="mt-2 text-[28px] font-bold leading-tight text-navy sm:text-[32px]">New purchase request</h1>
        <p className="mt-1 text-muted">Tell MPI what you need. Nothing goes to suppliers until you press Send and MPI approves the matches.</p>
      </div>

      <div className="mb-6 rounded-xl border-[1.5px] border-line bg-white soft-panel px-5 py-4 shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
        <StepBar current={step} reached={reached} onGo={go} />
      </div>

      <h2 className="sr-only">
        Step {step + 1}: {STEPS[step].label}
      </h2>

      {loadError && (
        <div className="mb-4">
          <Alert>{loadError} You can still describe what you need.</Alert>
        </div>
      )}

      {resumed && (
        <div className="mb-4">
          <Alert tone="info">
            <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
              <span>You were part-way through this request, so we kept it.</span>
              <button type="button" onClick={startAgain} className="font-semibold text-navy underline underline-offset-4">
                Start a new one instead
              </button>
            </span>
          </Alert>
        </div>
      )}

      {opening && <p className="mb-4 text-[15px] font-medium text-muted" role="status">Opening your draft…</p>}

      {step === 0 && (
        <DescribeStep
          draft={draft}
          update={update}
          categories={categories}
          voiceLanguage={voiceLanguage}
          setVoiceLanguage={setVoiceLanguage}
          aiBusy={aiBusy}
          aiError={aiError}
          onAiFill={() => void aiFill()}
          onPickCategory={pickCategory}
        />
      )}
      {step === 1 && (
        <ItemsStep
          draft={draft}
          update={update}
          categories={categories}
          catalogueItems={draft.categoryId ? (itemsByCategory[draft.categoryId] ?? null) : null}
          errors={errors}
        />
      )}
      {step === 2 && <DetailsStep draft={draft} update={update} errors={errors} />}
      {step === 3 && <DeliveryStep draft={draft} update={update} errors={errors} isService={isService} />}
      {step === 4 && <ReviewStep draft={draft} categories={categories} onEdit={go} update={update} />}

      {/* Back / Save / Next, always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-white/95 backdrop-blur">
        <div className="w-full px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
          <div aria-live="polite">
            {(stepError || saveError) && <p className="mb-2 text-sm font-semibold text-red-text">{saveError ?? stepError}</p>}
            {savedNote && <p className="mb-2 text-sm font-semibold text-navy">{savedNote}</p>}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {step === 0 ? (
              <Link to={MY_REQUESTS} aria-label="My requests" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-[15px] font-bold text-navy hover:bg-navy-tint">
                <ArrowLeft size={18} aria-hidden="true" />
                <span className="max-sm:hidden">My requests</span>
              </Link>
            ) : (
              <Button variant="ghost" onClick={back} disabled={!!saving} className="max-sm:px-3" aria-label="Back">
                <ArrowLeft size={18} aria-hidden="true" />
                <span className="max-sm:hidden">Back</span>
              </Button>
            )}
            <span className="ml-auto" />
            <Button
              variant="secondary"
              onClick={() => void save(false)}
              busy={saving === "draft"}
              disabled={!canSaveDraft || aiBusy || saving === "send"}
              className="max-sm:px-3"
            >
              <Save size={18} aria-hidden="true" />
              <span className="max-sm:hidden">Save as draft</span>
              <span className="sm:hidden">Save</span>
            </Button>
            {step < 4 ? (
              <Button onClick={next} busy={aiBusy} disabled={!!saving}>
                {nextLabel === "Let AI fill it" && <Sparkles size={18} aria-hidden="true" />}
                {aiBusy ? "Reading…" : nextLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={() => void save(true)} busy={saving === "send"} disabled={saving === "draft"} className="whitespace-nowrap">
                {saving === "send" ? "Sending…" : "Send to MPI"}
                <Send size={18} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
