/**
 * A service order's milestones, for the startup, the provider and the admin.
 *
 * Top: the milestone tracker, one step per milestone (pick one to see it).
 * Below: the picked milestone, with its "done when" points and what each
 * side does next:
 * - Startup: pay the milestone (simulated); read the submitted work, tick the
 *   "done when" points, then "Accept and release" or "Ask for changes".
 * - Provider: what it receives; once paid, the Submit work panel (a note,
 *   links, tick the points). Changes asked show in a red-tint box with
 *   "Change 1 of 2".
 * - Admin: everything, plus Pay out on an accepted milestone.
 * Earlier versions of the work fold into "Earlier versions".
 * Step 6b: "Raise a problem with MPI" on a paid milestone (both sides). An
 * open problem shows in a red box and stops the milestone; the admin decides
 * here (pay the provider, refund the startup, back to work). Submitted work
 * says when it is accepted automatically.
 */

import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ExternalLink,
  Hourglass,
  Info,
  Link2,
  ListChecks,
  MessageSquareWarning,
  Plus,
  Send,
  Wallet,
  X,
} from "lucide-react"
import {
  answerSubmission,
  AUTO_ACCEPT_DAYS,
  DECISION_LABEL,
  isAccepted,
  latestSubmission,
  MILESTONE_LABEL,
  openProblem,
  payMilestone,
  payOutMilestone,
  PROBLEM_REASONS,
  raiseProblem,
  resolveProblem,
  startupTodo,
  submitMilestone,
  type Milestone,
  type MilestoneStatus,
  type Problem,
  type ProblemDecision,
  type ProblemReason,
  type Submission,
} from "../../services/data/milestones"
import { SIMULATED_NOTE } from "../../services/data/money"
import Button from "../../ui/Button"
import { Alert, BOX, boxBorder } from "../../ui/form"
import { Chip, day, errorText, rupees } from "../supplier/parts"

export type ServiceSide = "startup" | "vendor" | "admin"

const TONE: Record<MilestoneStatus, "navy" | "orange" | "red" | "line"> = {
  planned: "line",
  in_progress: "orange",
  submitted: "orange",
  changes_asked: "red",
  accepted: "navy",
  paid_out: "navy",
  problem: "red",
  refunded: "line",
}

/** Status words per side: the provider reads "Paid, start work", the startup "Waiting for your payment". */
function statusText(m: Milestone, side: ServiceSide): string {
  if (m.status === "planned") return side === "startup" ? "Waiting for your payment" : "Waiting for payment"
  if (m.status === "submitted") return side === "startup" ? "Work to review" : "Waiting for the startup"
  if (side === "startup" && (m.status === "accepted" || m.status === "paid_out")) return "Accepted"
  if (m.status === "refunded") return side === "startup" ? "Refunded to you" : "Refunded to the startup"
  return MILESTONE_LABEL[m.status]
}

// ---------------------------------------------------------------- tracker

export function MilestoneTracker({
  milestones,
  selectedId,
  side,
  onSelect,
}: {
  milestones: Milestone[]
  selectedId: string
  side: ServiceSide
  onSelect: (id: string) => void
}) {
  return (
    <ol
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${milestones.length > 3 ? 9.5 : 11}rem, 1fr))` }}
      aria-label="Milestones"
    >
      {milestones.map((m) => {
        const done = isAccepted(m)
        const active = m.status !== "planned" && !done
        const selected = m.id === selectedId
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              aria-current={selected || undefined}
              className={`flex h-full w-full items-start gap-2.5 rounded-lg border-[1.5px] px-3 py-2.5 text-left transition-colors ${
                selected ? "border-orange bg-orange-tint/45 shadow-[0_2px_8px_rgba(240,154,71,0.25)]" : "border-line bg-white hover:border-orange/60"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
                  done ? "bg-navy text-orange" : active ? "btn-gradient text-navy" : "border-[1.5px] border-line bg-white text-muted"
                }`}
                aria-hidden="true"
              >
                {done ? <Check size={16} strokeWidth={3} /> : m.seq}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-navy" title={m.title}>
                  {m.title}
                </span>
                <span className={`block text-[12.5px] font-semibold ${m.status === "changes_asked" || m.status === "problem" ? "text-red-text" : "text-muted"}`}>
                  {statusText(m, side)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------- pieces

function Points({
  points,
  ticked,
  onToggle,
  label,
}: {
  points: string[]
  ticked: number[]
  onToggle?: (i: number) => void
  label: string
}) {
  if (!points.length) {
    return <p className="text-[14px] text-muted">No "done when" points were written for this deliverable.</p>
  }
  return (
    <fieldset>
      <legend className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.05em] text-muted">
        <ListChecks size={15} aria-hidden="true" /> {label}
      </legend>
      <ul className="space-y-1.5">
        {points.map((p, i) => {
          const on = ticked.includes(i)
          return (
            <li key={i}>
              {onToggle ? (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-white px-3 py-2 text-[14.5px] text-navy ring-1 ring-line hover:ring-orange/60">
                  <input type="checkbox" checked={on} onChange={() => onToggle(i)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#15233D]" />
                  {p}
                </label>
              ) : (
                <span className="flex items-start gap-2.5 rounded-lg bg-white px-3 py-2 text-[14.5px] text-navy ring-1 ring-line">
                  {on ? (
                    <CheckCircle2 size={18} className="mt-px shrink-0 text-navy" aria-label="Confirmed" />
                  ) : (
                    <CircleDot size={18} className="mt-px shrink-0 text-muted" aria-label="Not confirmed" />
                  )}
                  {p}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

function Links({ links }: { links: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((l) => (
        <li key={l} className="min-w-0 max-w-full">
          <a
            href={l}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13.5px] font-semibold text-navy ring-1 ring-line hover:ring-navy"
          >
            <Link2 size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{l.replace(/^https?:\/\//, "")}</span>
            <ExternalLink size={13} className="shrink-0 text-muted" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  )
}

/** The provider's work as submitted: note, links, and the points they confirmed. */
function SubmissionView({ s, m, title }: { s: Submission; m: Milestone; title: string }) {
  return (
    <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] font-bold text-navy">{title}</p>
        <p className="text-[12.5px] text-muted">
          Version {s.version} · {day(s.submitted_at, true)}
        </p>
      </div>
      <p className="whitespace-pre-line text-[14.5px] text-navy">{s.note}</p>
      <Links links={s.links} />
      {m.done_when.length > 0 && (
        <p className="text-[13px] text-muted">
          The provider confirms {s.points_done.length} of {m.done_when.length} "done when" point{m.done_when.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  )
}

/** The startup's note when it asked for changes. */
function ChangesBox({ m, s }: { m: Milestone; s: Submission }) {
  const n = m.submissions.filter((x) => x.answer === "changes" && x.version <= s.version).length
  return (
    <div className="rounded-xl border-[1.5px] border-red/40 bg-red-tint p-4">
      <p className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-bold uppercase tracking-[0.05em] text-red-text">
        <span className="inline-flex items-center gap-1.5">
          <MessageSquareWarning size={16} aria-hidden="true" /> Changes asked
        </span>
        <span>
          Change {n} of {m.changes_allowed}
        </span>
      </p>
      <p className="mt-1.5 whitespace-pre-line text-[15px] text-navy">{s.answer_note}</p>
      <p className="mt-1 text-[12.5px] text-muted">{s.answered_at ? day(s.answered_at, true) : ""}</p>
    </div>
  )
}

function Earlier({ m }: { m: Milestone }) {
  const older = m.submissions.slice(0, -1)
  if (!older.length) return null
  return (
    <details className="group rounded-xl bg-page/70 px-4 py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold text-navy">
        Earlier versions ({older.length})
        <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-2 space-y-2">
        {older
          .slice()
          .reverse()
          .map((s) => (
            <li key={s.id} className="rounded-lg bg-white px-3 py-2 text-[13.5px] ring-1 ring-line">
              <p className="font-semibold text-navy">
                Version {s.version} · {day(s.submitted_at)}
              </p>
              <p className="text-navy">{s.note}</p>
              {s.answer === "changes" && <p className="mt-1 text-red-text">Changes asked: {s.answer_note}</p>}
            </li>
          ))}
      </ul>
    </details>
  )
}

function NavyBar({ label, value, hint, children }: { label: string; value: string; hint: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-navy p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white/75">{label}</p>
        <p className="font-display text-[28px] font-bold leading-tight text-orange">{value}</p>
        <p className="text-[13px] text-white/75">{hint}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

function Note({ icon: Icon = Info, children }: { icon?: typeof Info; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-navy-tint/60 px-4 py-3 text-[14px] text-navy">
      <Icon size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

// ---------------------------------------------------------------- problems

const raisedByText = (p: Problem, side: ServiceSide) =>
  (p.raised_by === "startup" && side === "startup") || (p.raised_by === "provider" && side === "vendor")
    ? "You raised a problem"
    : p.raised_by === "startup"
      ? "The startup raised a problem"
      : "The provider raised a problem"

function ProblemBox({ p, side }: { p: Problem; side: ServiceSide }) {
  return (
    <div className="rounded-xl border-[1.5px] border-red/40 bg-red-tint p-4">
      <p className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-bold uppercase tracking-[0.05em] text-red-text">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle size={16} aria-hidden="true" /> {raisedByText(p, side)}
        </span>
        <span>{PROBLEM_REASONS[p.reason]}</span>
      </p>
      <p className="mt-1.5 whitespace-pre-line text-[15px] text-navy">{p.description}</p>
      {p.links.length > 0 && (
        <div className="mt-2">
          <Links links={p.links} />
        </div>
      )}
      <p className="mt-2 text-[13px] font-semibold text-navy">
        {side === "admin"
          ? `Raised ${day(p.created_at, true)}. The milestone is on hold until you decide.`
          : `Raised ${day(p.created_at, true)}. MPI is looking at it. Nothing on this milestone moves until MPI decides.`}
      </p>
    </div>
  )
}

/** The last decision MPI made on this milestone, if any. */
function DecisionNote({ m }: { m: Milestone }) {
  const p = [...(m.problems ?? [])].reverse().find((x) => x.status === "resolved")
  if (!p || !p.decision) return null
  return (
    <Note icon={BadgeCheck}>
      <strong>MPI decided: {DECISION_LABEL[p.decision].toLowerCase()}</strong> ({day(p.decided_at)}). {p.decision_note}
    </Note>
  )
}

function RaiseProblem({ m, side, onDone }: { m: Milestone; side: ServiceSide; onDone: (msg: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ProblemReason | "">("")
  const [text, setText] = useState("")
  const [link, setLink] = useState("")
  const { busy, error, run } = useAction(onDone)
  const badLink = link.trim() !== "" && !/^https?:\/\/\S+$/i.test(link.trim())
  const ready = reason !== "" && text.trim().length >= 10 && !badLink
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-red-text underline-offset-2 hover:underline"
      >
        <AlertTriangle size={15} aria-hidden="true" /> Raise a problem with MPI
      </button>
    )
  }
  return (
    <div className="rounded-xl border-[1.5px] border-red/40 bg-white p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Raise a problem with MPI</p>
      <p className="mt-1 text-[13.5px] text-muted">
        MPI looks at it and decides. Until then this milestone is on hold: {side === "startup" ? "nothing is accepted or paid out" : "the startup can't accept it and nothing is paid out"}.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label htmlFor={`pr-${m.id}`} className="mb-1.5 block text-sm font-semibold text-navy">
              What's wrong?
            </label>
            <select
              id={`pr-${m.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value as ProblemReason)}
              className={`${BOX} ${boxBorder()} min-h-11 text-[15px]`}
            >
              <option value="">Pick a reason</option>
              {(Object.keys(PROBLEM_REASONS) as ProblemReason[])
                .filter((r) => (side === "startup" ? r !== "payment" : r !== "quality" && r !== "not_as_agreed"))
                .map((r) => (
                  <option key={r} value={r}>
                    {PROBLEM_REASONS[r]}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor={`pl-${m.id}`} className="mb-1.5 block text-sm font-semibold text-navy">
              A link that shows it <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id={`pl-${m.id}`}
              type="url"
              value={link}
              placeholder="https://"
              onChange={(e) => setLink(e.target.value)}
              className={`${BOX} ${boxBorder(badLink ? "bad" : null)} min-h-11`}
            />
          </div>
        </div>
        <div>
          <label htmlFor={`pd-${m.id}`} className="mb-1.5 block text-sm font-semibold text-navy">
            Describe it
          </label>
          <textarea
            id={`pd-${m.id}`}
            rows={4}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What happened, and what you expected"
            className={`${BOX} ${boxBorder()} py-2.5`}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={!ready || busy !== null}
          busy={busy === "raise"}
          onClick={() => run("raise", () => raiseProblem(m.id, reason as ProblemReason, text.trim(), link.trim() ? [link.trim()] : []), "Problem sent to MPI. Both sides are told.")}
        >
          Send to MPI
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

/** Admin: decide an open problem. */
function ResolveProblem({ p, m, onDone }: { p: Problem; m: Milestone; onDone: (msg: string) => Promise<void> }) {
  const [decision, setDecision] = useState<ProblemDecision | null>(null)
  const [note, setNote] = useState("")
  const { busy, error, run } = useAction(onDone)
  const options: { id: ProblemDecision; hint: string }[] = [
    { id: "pay_provider", hint: `The work counts as accepted and ${rupees(m.payout ?? 0)} goes to Payouts to send.` },
    { id: "refund_startup", hint: `${rupees(m.amount)} goes back to the startup (simulated). MPI's fee is kept.` },
    { id: "back_to_work", hint: "The provider works on it again. No round of changes is used." },
  ]
  return (
    <div className="rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Your decision</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="Decision">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={decision === o.id}
            onClick={() => setDecision(o.id)}
            className={`rounded-lg border-[1.5px] p-3 text-left ${decision === o.id ? "border-navy bg-white shadow-sm" : "border-line bg-white/70 hover:border-navy/50"}`}
          >
            <span className="block text-[14.5px] font-bold text-navy">{DECISION_LABEL[o.id]}</span>
            <span className="block text-[12.5px] text-muted">{o.hint}</span>
          </button>
        ))}
      </div>
      <label htmlFor={`rn-${p.id}`} className="mt-3 mb-1.5 block text-sm font-semibold text-navy">
        Why <span className="font-normal text-muted">(both sides see this)</span>
      </label>
      <textarea
        id={`rn-${p.id}`}
        rows={2}
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className={`${BOX} ${boxBorder()} py-2.5`}
      />
      <Button
        className="mt-3"
        disabled={!decision || note.trim().length < 3 || busy !== null}
        busy={busy === "resolve"}
        onClick={() => decision && run("resolve", () => resolveProblem(p.id, decision, note.trim()), `Decided: ${DECISION_LABEL[decision].toLowerCase()}`)}
      >
        Confirm decision
      </Button>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- actions

function useAction(onDone: (msg: string) => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await onDone(msg)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, run }
}

/** Provider: Submit work. */
function SubmitWork({ m, onDone }: { m: Milestone; onDone: (msg: string) => Promise<void> }) {
  const last = latestSubmission(m)
  const [note, setNote] = useState("")
  const [links, setLinks] = useState<string[]>(last?.links.length ? last.links : [""])
  const [ticked, setTicked] = useState<number[]>(last?.points_done ?? [])
  const { busy, error, run } = useAction(onDone)
  const cleanLinks = links.map((l) => l.trim()).filter(Boolean)
  const badLink = cleanLinks.find((l) => !/^https?:\/\/\S+$/i.test(l))
  const allTicked = ticked.length === m.done_when.length
  const ready = note.trim().length >= 3 && cleanLinks.length > 0 && !badLink && allTicked
  const toggle = (i: number) => setTicked((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))

  return (
    <div className="rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">
        {m.status === "changes_asked" ? "Send the changed work" : "Submit work"}
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label htmlFor={`note-${m.id}`} className="mb-1.5 block text-sm font-semibold text-navy">
              What you did
            </label>
            <textarea
              id={`note-${m.id}`}
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={m.status === "changes_asked" ? "What you changed, in a line or two" : "A short note for the startup"}
              className={`${BOX} ${boxBorder()} py-2.5`}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-navy">Links to the work</p>
            <ul className="space-y-2">
              {links.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    type="url"
                    inputMode="url"
                    value={l}
                    aria-label={`Link ${i + 1}`}
                    placeholder="https://"
                    onChange={(e) => setLinks((ls) => ls.map((x, j) => (j === i ? e.target.value : x)))}
                    className={`${BOX} ${boxBorder(l.trim() && !/^https?:\/\/\S+$/i.test(l.trim()) ? "bad" : null)} min-h-11`}
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}
                      aria-label={`Remove link ${i + 1}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-white hover:text-navy"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {links.length < 5 && (
              <button
                type="button"
                onClick={() => setLinks((ls) => [...ls, ""])}
                className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-navy hover:underline"
              >
                <Plus size={15} aria-hidden="true" /> Add another link
              </button>
            )}
            <p className="mt-1 text-[12.5px] text-muted">Share links (Figma, Drive, GitHub, a live page). File uploads come later.</p>
          </div>
        </div>
        <div className="space-y-3">
          <Points points={m.done_when} ticked={ticked} onToggle={toggle} label="Tick what's done" />
          <Button
            className="w-full"
            disabled={!ready || busy !== null}
            busy={busy === "submit"}
            onClick={() => run("submit", () => submitMilestone(m.id, note.trim(), cleanLinks, ticked), "Work submitted. The startup is told.")}
          >
            <Send size={16} aria-hidden="true" /> Submit milestone {m.seq}
          </Button>
          {!ready && (
            <p className="text-[12.5px] text-muted">
              {badLink
                ? "Each link must start with http:// or https://"
                : !allTicked && m.done_when.length
                  ? "Tick every \"done when\" point once the work meets it."
                  : "Add a note and at least one link."}
            </p>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  )
}

/** Startup: review the work, then accept or ask for changes. */
function ReviewWork({ m, s, onDone }: { m: Milestone; s: Submission; onDone: (msg: string) => Promise<void> }) {
  const [ticked, setTicked] = useState<number[]>([])
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState("")
  const { busy, error, run } = useAction(onDone)
  const left = m.changes_allowed - m.changes_used
  const toggle = (i: number) => setTicked((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SubmissionView s={s} m={m} title="The provider's work" />
        <div className="rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Your next step</p>
          <div className="mt-2">
            <Points points={m.done_when} ticked={ticked} onToggle={toggle} label="Check each point" />
          </div>
          {asking ? (
            <div className="mt-3 space-y-2">
              <label htmlFor={`chg-${m.id}`} className="block text-sm font-semibold text-navy">
                What needs to change? <span className="font-normal text-muted">(change {m.changes_used + 1} of {m.changes_allowed})</span>
              </label>
              <textarea
                id={`chg-${m.id}`}
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Be specific, so the provider can fix it in one go"
                className={`${BOX} ${boxBorder()} py-2.5`}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  disabled={note.trim().length < 3 || busy !== null}
                  busy={busy === "changes"}
                  onClick={() => run("changes", () => answerSubmission(s.id, false, note.trim(), ticked), "Changes asked. The provider is told.")}
                >
                  Send the changes
                </Button>
                <Button variant="ghost" onClick={() => setAsking(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={busy !== null}
                busy={busy === "accept"}
                onClick={() => run("accept", () => answerSubmission(s.id, true, null, ticked), `Accepted. MPI releases ${rupees(m.amount)} to the provider.`)}
              >
                <BadgeCheck size={17} aria-hidden="true" /> Accept and release {rupees(m.amount)}
              </Button>
              <Button variant="secondary" disabled={left <= 0} onClick={() => setAsking(true)}>
                Ask for changes
              </Button>
            </div>
          )}
          {m.auto_accept_at && (
            <p className="mt-2 text-[12.5px] font-semibold text-navy">
              If you don't answer by {day(m.auto_accept_at, true)}, MPI accepts the work automatically ({AUTO_ACCEPT_DAYS} days).
            </p>
          )}
          <p className="mt-1 text-[12.5px] text-muted">
            {left > 0
              ? `${left} of ${m.changes_allowed} round${m.changes_allowed === 1 ? "" : "s"} of changes left, as agreed in the proposal.`
              : `All ${m.changes_allowed} round${m.changes_allowed === 1 ? "" : "s"} of changes are used. Accept the work, or use Need help to talk to MPI.`}
          </p>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  )
}

// ---------------------------------------------------------------- one milestone

export function MilestoneDetail({
  m,
  milestones,
  side,
  onDone,
}: {
  m: Milestone
  milestones: Milestone[]
  side: ServiceSide
  onDone: (msg: string) => Promise<void>
}) {
  const last = latestSubmission(m)
  const pay = useAction(onDone)
  const todo = startupTodo(milestones)
  const canPay = side === "startup" && todo?.kind === "pay" && todo.milestone.id === m.id
  const prevOpen = milestones.find((x) => x.seq < m.seq && !isAccepted(x))
  const canRaise = side !== "admin" && ["in_progress", "submitted", "changes_asked", "accepted"].includes(m.status)

  let body: ReactNode = null
  if (m.status === "planned") {
    if (side === "startup") {
      body = canPay ? (
        <NavyBar
          label={`Pay milestone ${m.seq}`}
          value={rupees(m.to_pay ?? m.amount)}
          hint={m.mpi_fee_now ? `${rupees(m.amount)} for the work + ${rupees(m.mpi_fee_now)} MPI fee. MPI holds it until you accept.` : "MPI holds it until you accept the work."}
        >
          <Button
            busy={pay.busy === "pay"}
            onClick={() => pay.run("pay", () => payMilestone(m.id), `Paid milestone ${m.seq} (simulated). The provider can start.`)}
          >
            <Wallet size={17} aria-hidden="true" /> Pay milestone {m.seq}, {rupees(m.to_pay ?? m.amount)}
          </Button>
        </NavyBar>
      ) : (
        <Note icon={Hourglass}>
          {prevOpen ? `You pay this milestone once you accept milestone ${prevOpen.seq}.` : "Not paid yet."} It costs {rupees(m.amount)}.
        </Note>
      )
    } else {
      body = <Note icon={Hourglass}>Waiting for the startup to pay this milestone. {side === "vendor" ? "You'll be told when you can start." : ""}</Note>
    }
  } else if (m.status === "in_progress" || m.status === "changes_asked") {
    const changed = m.status === "changes_asked" && last ? <ChangesBox m={m} s={last} /> : null
    body =
      side === "vendor" ? (
        <div className="space-y-4">
          {changed}
          <SubmitWork key={`${m.id}-${m.submissions.length}`} m={m} onDone={onDone} />
        </div>
      ) : (
        <div className="space-y-3">
          {changed}
          <Note icon={Hourglass}>
            {m.status === "changes_asked" ? "The provider is making the changes." : "The provider is working on it."} MPI holds the payment until{" "}
            {side === "startup" ? "you accept" : "the startup accepts"} the work.
          </Note>
        </div>
      )
  } else if (m.status === "submitted" && last) {
    body =
      side === "startup" ? (
        <ReviewWork key={last.id} m={m} s={last} onDone={onDone} />
      ) : (
        <div className="space-y-3">
          <SubmissionView s={last} m={m} title={side === "vendor" ? "What you sent" : "The provider's work"} />
          <Note icon={Hourglass}>
            Waiting for the startup to accept the work or ask for changes.
            {m.auto_accept_at ? ` If they don't answer by ${day(m.auto_accept_at, true)}, MPI accepts it automatically.` : ""}
          </Note>
        </div>
      )
  } else if (m.status === "problem") {
    const p = openProblem(m)
    body = (
      <div className="space-y-3">
        {p && <ProblemBox p={p} side={side} />}
        {side === "admin" && p && <ResolveProblem p={p} m={m} onDone={onDone} />}
        {last && <SubmissionView s={last} m={m} title={side === "vendor" ? "What you sent" : "The provider's work"} />}
      </div>
    )
  } else if (m.status === "refunded") {
    body = (
      <Note icon={CheckCircle2}>
        {side === "vendor"
          ? `MPI refunded this milestone to the startup on ${day(m.refunded_at, true)}. Nothing is paid out for it.`
          : `Refunded ${rupees(m.amount)} to ${side === "startup" ? "you" : "the startup"} on ${day(m.refunded_at, true)} (simulated).`}
      </Note>
    )
  } else if (m.status === "accepted" || m.status === "paid_out") {
    body = (
      <div className="space-y-3">
        {last && <SubmissionView s={last} m={m} title="Accepted work" />}
        {side === "admin" && m.status === "accepted" ? (
          <NavyBar label="Payout to send" value={rupees(m.payout ?? 0)} hint={`${rupees(m.amount)} minus ${rupees(m.commission ?? 0)} MPI commission incl. GST`}>
            <Button
              busy={pay.busy === "payout"}
              onClick={() => pay.run("payout", () => payOutMilestone(m.id), `Paid out ${rupees(m.payout ?? 0)} for milestone ${m.seq} (simulated)`)}
            >
              <Banknote size={17} aria-hidden="true" /> Pay out {rupees(m.payout ?? 0)}
            </Button>
          </NavyBar>
        ) : (
          <Note icon={CheckCircle2}>
            {m.status === "paid_out"
              ? side === "startup"
                ? `Accepted on ${day(m.accepted_at)}. MPI paid the provider.`
                : `Paid out ${side === "vendor" ? "to you " : ""}on ${day(m.paid_out_at, true)}${m.payout != null ? `: ${rupees(m.payout)}` : ""}.`
              : side === "startup"
                ? `You accepted this on ${day(m.accepted_at)}. MPI now pays the provider.`
                : `Accepted on ${day(m.accepted_at)}. MPI will send your payout of ${rupees(m.payout ?? 0)}.`}
          </Note>
        )}
      </div>
    )
  }

  return (
    <article className="space-y-4 rounded-xl border-[1.5px] border-line soft-panel p-4 sm:p-5" aria-label={`Milestone ${m.seq}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-muted">
            Milestone {m.seq} of {milestones.length}
          </p>
          <h3 className="font-display text-[19px] font-bold leading-snug text-navy">{m.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Chip tone={TONE[m.status]}>{statusText(m, side)}</Chip>
            <span className="text-[12.5px] text-muted">
              {m.changes_used} of {m.changes_allowed} round{m.changes_allowed === 1 ? "" : "s"} of changes used
            </span>
          </div>
        </div>
        <div className="text-left sm:text-right">
          {side === "vendor" ? (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">You receive</p>
              <p className="font-display text-[22px] font-bold leading-tight text-navy">{rupees(m.payout ?? 0)}</p>
              <p className="text-[12px] text-muted">{m.status === "paid_out" ? "Paid out" : m.status === "accepted" ? "Payout pending" : m.status === "refunded" ? "Refunded, not paid out" : m.status === "problem" ? "On hold with MPI" : `after ${rupees(m.commission ?? 0)} MPI commission`}</p>
            </>
          ) : (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">{side === "admin" ? "Startup pays" : "This milestone"}</p>
              <p className="font-display text-[22px] font-bold leading-tight text-navy">{rupees(m.amount)}</p>
              <p className="text-[12px] text-muted">{m.refunded_at
                  ? `Refunded ${day(m.refunded_at)}`
                  : m.paid_out_at
                    ? `Paid ${day(m.paid_at ?? m.paid_out_at)}, sent to the provider`
                    : m.paid_at
                      ? `Paid ${day(m.paid_at)}, held by MPI`
                      : "Not paid yet"}</p>
            </>
          )}
        </div>
      </div>

      {body}
      {!(m.status === "in_progress" && side === "vendor") && !(m.status === "changes_asked" && side === "vendor") && !(m.status === "submitted" && side === "startup") && (
        <Points
          points={m.done_when}
          ticked={isAccepted(m) ? (last?.points_checked.length ? last.points_checked : m.done_when.map((_, i) => i)) : (last?.points_done ?? [])}
          label='Done when'
        />
      )}

      {pay.error && <Alert>{pay.error}</Alert>}
      {m.status !== "problem" && <DecisionNote m={m} />}
      <Earlier m={m} />
      {canRaise && <RaiseProblem key={m.status} m={m} side={side} onDone={onDone} />}
      <p className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
        <Info size={14} aria-hidden="true" /> {SIMULATED_NOTE} Work is shared as links for now.
      </p>
    </article>
  )
}

// ---------------------------------------------------------------- whole

export default function ServiceOrderProgress({
  milestones,
  side,
  onDone,
}: {
  milestones: Milestone[]
  side: ServiceSide
  onDone: (msg: string) => Promise<void>
}) {
  const todo =
    side === "startup"
      ? startupTodo(milestones)?.milestone
      : side === "vendor"
        ? milestones.find((m) => m.status === "in_progress" || m.status === "changes_asked")
        : (milestones.find((m) => m.status === "problem") ?? milestones.find((m) => m.status === "accepted"))
  const problem = milestones.find((m) => m.status === "problem")
  const fallback = problem ?? milestones.find((m) => !isAccepted(m)) ?? milestones[milestones.length - 1]
  const [picked, setPicked] = useState<string | null>(null)
  const m = milestones.find((x) => x.id === picked) ?? (side !== "admin" ? problem : undefined) ?? todo ?? fallback
  const received = milestones.filter((x) => x.status === "paid_out").reduce((n, x) => n + (x.payout ?? 0), 0)
  const accepted = milestones.filter((x) => x.status === "accepted" || x.status === "paid_out").length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-navy">
        <p>
          <strong>{accepted}</strong> of {milestones.length} milestone{milestones.length === 1 ? "" : "s"} accepted
          {side === "vendor" && received > 0 && (
            <>
              {" "}
              · <strong>{rupees(received)}</strong> paid out to you
            </>
          )}
        </p>
      </div>
      <MilestoneTracker milestones={milestones} selectedId={m.id} side={side} onSelect={setPicked} />
      <MilestoneDetail key={m.id} m={m} milestones={milestones} side={side} onDone={onDone} />
    </div>
  )
}
