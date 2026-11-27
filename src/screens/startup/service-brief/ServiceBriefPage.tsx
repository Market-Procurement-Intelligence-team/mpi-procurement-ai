/**
 * New service brief (/startup/requests/new?kind=service), in 4 steps:
 *   1 What you need (kind of service, own words or voice, AI writes the brief)
 *   2 Deliverables & timing
 *   3 Budget & providers
 *   4 Review & send
 * Saved as a request of kind "service". Can be saved as a draft from any
 * step; going back never loses anything. Goods use the normal New request.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { ArrowLeft, ArrowRight, BadgeCheck, CircleCheck, Save, Send, Sparkles } from "lucide-react"
import { useMe } from "../../../app/session"
import type { VoiceLanguage } from "../../../lib/voiceInput"
import { readBrief } from "../../../services/data/ai"
import { listCategories, type Category } from "../../../services/data/catalogue"
import { freelancersOpen, listSkills, type Skill } from "../../../services/data/providers"
import { briefColumns, createRequest, getRequestDetail, replaceLines, sendRequest, updateRequest } from "../../../services/data/requests"
import Button from "../../../ui/Button"
import { Alert } from "../../../ui/form"
import type { Errors } from "../new-request/draft"
import StepBar from "../new-request/StepBar"
import {
  applyBriefReading,
  BRIEF_STEPS,
  briefErrors,
  clearBrief,
  emptyDeliverable,
  emptyServiceDraft,
  fromServiceRequest,
  loadBrief,
  storeBrief,
  toBriefInput,
  type BriefStep,
  type ServiceDraft,
} from "./brief"
import BudgetStep from "./BudgetStep"
import DeliverablesStep from "./DeliverablesStep"
import KindSwitch from "./KindSwitch"
import NeedStep from "./NeedStep"
import ReviewBrief from "./ReviewBrief"

const MY_REQUESTS = "/startup/requests"

const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

export default function ServiceBriefPage() {
  const me = useMe()
  const [params] = useSearchParams()
  const draftId = params.get("draft")
  const initial = useRef(loadBrief())
  const [draft, setDraft] = useState<ServiceDraft>(initial.current?.draft ?? emptyServiceDraft())
  const [step, setStep] = useState<BriefStep>(initial.current?.step ?? 0)
  const [reached, setReached] = useState<BriefStep>(initial.current?.step ?? 0)
  const [requestId, setRequestId] = useState<string | null>(initial.current?.requestId ?? null)
  const [errors, setErrors] = useState<Errors>({})
  const [stepError, setStepError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [freelancersOn, setFreelancersOn] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>("en")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [saving, setSaving] = useState<"draft" | "send" | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [sent, setSent] = useState<{ title: string } | null>(null)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = "New service brief · MPI"
    listCategories()
      .then((all) => setCategories(all.filter((c) => !c.is_tangible && c.is_active)))
      .catch((err) => {
        setCategories([])
        setLoadError(messageOf(err, "Couldn't load the kinds of service."))
      })
    listSkills().then(setSkills).catch(() => setSkills([]))
    freelancersOpen().then(setFreelancersOn).catch(() => setFreelancersOn(false))
  }, [])

  // "Continue" on a draft brief opens it here.
  useEffect(() => {
    if (!draftId || draftId === initial.current?.requestId) return
    let alive = true
    getRequestDetail(draftId)
      .then(({ request }) => {
        if (!alive) return
        if (request.status !== "draft") return setLoadError("This brief has already been sent, so it can't be changed here.")
        setDraft(fromServiceRequest(request))
        setRequestId(request.id)
        setStep(1)
        setReached(3)
      })
      .catch((err) => alive && setLoadError(messageOf(err, "Couldn't open this draft.")))
    return () => {
      alive = false
    }
  }, [draftId])

  useEffect(() => {
    if (!sent) storeBrief({ draft, step, requestId })
  }, [draft, step, requestId, sent])

  const update = useCallback((patch: Partial<ServiceDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSavedNote(null)
  }, [])

  const go = useCallback((next: BriefStep) => {
    setStep(next)
    setReached((r) => (next > r ? next : r))
    setErrors({})
    setStepError(null)
    setSaveError(null)
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // Clear an error once its box is fixed.
  useEffect(() => {
    if (!Object.keys(errors).length || step > 2) return
    const now = briefErrors(step, draft)
    const kept = Object.fromEntries(Object.entries(errors).filter(([k]) => now[k]))
    if (Object.keys(kept).length === Object.keys(errors).length) return
    setErrors(kept)
    if (!Object.keys(kept).length) setStepError(null)
  }, [draft, step, errors])

  const aiFill = async () => {
    const text = draft.text.trim()
    if (!text) return
    setAiBusy(true)
    setAiError(null)
    try {
      const reading = await readBrief(text)
      setDraft((d) => applyBriefReading(d, reading))
    } catch (err) {
      setAiError(messageOf(err, "The AI couldn't write the brief right now."))
    } finally {
      setAiBusy(false)
    }
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
    if (step > 2) return
    const found = briefErrors(step, draft)
    if (Object.keys(found).length) return showErrors(found)
    if (step === 0 && !draft.deliverables.length) setDraft((d) => ({ ...d, deliverables: [emptyDeliverable()] }))
    go((step + 1) as BriefStep)
  }

  const canSaveDraft = draft.text.trim() !== "" || draft.title.trim() !== "" || draft.deliverables.some((d) => d.title.trim())

  const save = async (send: boolean) => {
    if (send) {
      for (const s of [0, 1, 2] as BriefStep[]) {
        const found = briefErrors(s, draft)
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
      const input = toBriefInput(draft)
      let id = requestId
      if (id) {
        await updateRequest(id, {
          title: input.title,
          description: input.description ?? null,
          requirement_text: input.requirementText ?? null,
          input_language: input.inputLanguage ?? null,
          ai_extracted: input.aiExtracted ?? null,
          scheme_ids: input.schemeIds ?? [],
          category_id: input.categoryId ?? null,
          source: input.source ?? "catalogue",
          needed_by: input.neededBy ?? null,
          delivery_city: input.deliveryCity ?? null,
          delivery_state: input.deliveryState ?? null,
          budget_min: input.budgetMin ?? null,
          budget_max: input.budgetMax ?? null,
          ...briefColumns(input.brief!),
        })
        await replaceLines(id, input.lines)
        if (send) await sendRequest(id)
      } else {
        const created = await createRequest(me.organisation.id, me.userId, input, send)
        id = created.id
        setRequestId(id)
      }
      if (send) {
        clearBrief()
        setSent({ title: input.title })
        top.current?.scrollIntoView({ block: "start" })
      } else {
        setSavedNote("Saved as a draft. You can find it in My requests and finish it later.")
      }
    } catch (err) {
      setSaveError(messageOf(err, send ? "Couldn't send your brief. Please try again." : "Couldn't save the draft. Please try again."))
    } finally {
      setSaving(null)
    }
  }

  const startAgain = () => {
    clearBrief()
    setDraft(emptyServiceDraft())
    setRequestId(null)
    setSent(null)
    setStep(0)
    setReached(0)
    setAiError(null)
    setSavedNote(null)
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
            <h1 className="mt-5 text-[28px] font-bold leading-tight text-navy">Brief sent to MPI</h1>
            <p className="mt-2 text-lg font-semibold text-navy">{sent.title}</p>
            <ul className="mx-auto mt-6 max-w-md space-y-3 text-left text-[15px] text-navy">
              <li className="flex gap-3">
                <Sparkles size={20} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
                MPI's AI is now looking for checked providers who fit your brief.
              </li>
              <li className="flex gap-3">
                <BadgeCheck size={20} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
                The MPI team approves every match. You'll get a notification when proposals arrive.
              </li>
            </ul>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={MY_REQUESTS} className="btn-gradient inline-flex min-h-11 items-center justify-center rounded-md px-5 font-bold text-navy shadow-sm hover:brightness-95">
                Go to My requests
              </Link>
              <Button variant="secondary" onClick={startAgain}>
                Write another brief
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const categorySkills = skills.filter((s) => s.category_id === draft.categoryId)

  return (
    <div ref={top} className="scroll-mt-24 pb-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-muted">
            <Link to={MY_REQUESTS} className="font-medium hover:text-navy hover:underline">
              My requests
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-navy">New service brief</span>
          </nav>
          <h1 className="mt-2 text-[28px] font-bold leading-tight text-navy sm:text-[32px]">New service brief</h1>
          <p className="mt-1 text-muted">Say what work you need done. Nothing goes to providers until you press Send and MPI approves the matches.</p>
        </div>
        <KindSwitch value="service" />
      </div>

      <div className="mb-6 rounded-xl border-[1.5px] border-line bg-white soft-panel px-5 py-4 shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
        <StepBar<BriefStep> current={step} reached={reached} onGo={go} steps={BRIEF_STEPS} />
      </div>

      {loadError && (
        <div className="mb-4">
          <Alert>{loadError}</Alert>
        </div>
      )}

      {step === 0 && (
        <NeedStep
          draft={draft}
          update={update}
          categories={categories}
          skills={skills}
          errors={errors}
          voiceLanguage={voiceLanguage}
          setVoiceLanguage={setVoiceLanguage}
          aiBusy={aiBusy}
          aiError={aiError}
          onAiFill={() => void aiFill()}
        />
      )}
      {step === 1 && <DeliverablesStep draft={draft} update={update} skills={categorySkills} errors={errors} />}
      {step === 2 && <BudgetStep draft={draft} update={update} errors={errors} freelancersOn={freelancersOn} />}
      {step === 3 && <ReviewBrief draft={draft} categories={categories} skills={skills} onEdit={go} update={update} />}

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
              <Button variant="ghost" onClick={() => go((step - 1) as BriefStep)} disabled={!!saving} className="max-sm:px-3" aria-label="Back">
                <ArrowLeft size={18} aria-hidden="true" />
                <span className="max-sm:hidden">Back</span>
              </Button>
            )}
            <span className="ml-auto" />
            <Button variant="secondary" onClick={() => void save(false)} busy={saving === "draft"} disabled={!canSaveDraft || aiBusy || saving === "send"} className="max-sm:px-3">
              <Save size={18} aria-hidden="true" />
              <span className="max-sm:hidden">Save as draft</span>
              <span className="sm:hidden">Save</span>
            </Button>
            {step < 3 ? (
              <Button onClick={next} disabled={!!saving || aiBusy}>
                Next
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            ) : (
              <Button onClick={() => void save(true)} busy={saving === "send"} disabled={saving === "draft"} className="whitespace-nowrap">
                {saving === "send" ? "Sending…" : "Send brief to MPI"}
                <Send size={18} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
