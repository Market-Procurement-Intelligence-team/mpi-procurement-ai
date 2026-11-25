/**
 * Admin: one freelancer, on the right of the review queue.
 *
 * Header: anonymous code, real name (only MPI sees it), status and what is
 * still missing. Three tabs keep it short: "As startups see it" (the same
 * anonymous profile startups get), "Checks" (verify or reject each check),
 * and "Private details". A decision bar stays at the bottom: approve and go
 * live, ask for changes (note required, the freelancer sees it), or suspend
 * (asks to confirm).
 */

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, CircleAlert, CircleCheck, Lock, MapPin, MessageSquareText, Rocket, ShieldOff } from "lucide-react"
import {
  getMyProviderProfile,
  getProviderPrivate,
  reviewProvider,
  type MyProviderProfile,
  type ProviderForReview,
} from "../../../services/data/providers"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import PublicProfile, { AnonAvatar, fromOwnProfile } from "../../freelancer/PublicProfile"
import { readiness } from "../../freelancer/useBuilder"
import { ago, Chip, day, errorText, TabBar } from "../../supplier/parts"
import { ChecksTab, PrivateTab } from "./ReviewTabs"
import { changesAsked, filterOf, STATUS_CHIP } from "./shared"

type Tab = "profile" | "checks" | "private"

interface Props {
  item: ProviderForReview
  categoryName: (id: string | null) => string | null
  onBack: () => void
  onDone: (msg: string) => Promise<void>
}

export default function ReviewPanel({ item, categoryName, onBack, onDone }: Props) {
  const orgId = item.org.id
  const [data, setData] = useState<MyProviderProfile | null>(null)
  const [priv, setPriv] = useState<{ pan: string | null; email: string | null }>({ pan: null, email: null })
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("profile")

  const load = useCallback(async () => {
    try {
      const [d, x] = await Promise.all([getMyProviderProfile(orgId), getProviderPrivate(orgId).catch(() => ({ pan: null, email: null }))])
      setData(d)
      setPriv(x)
      setError(d ? null : "This freelancer has no profile yet.")
    } catch (err) {
      setError(errorText(err))
    }
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  const done = async (msg: string) => {
    await load()
    await onDone(msg)
  }

  const p = data?.profile ?? item.profile
  const filter = filterOf(p)
  const chip = STATUS_CHIP[filter]
  const ready = data ? readiness(data) : null
  const pendingChecks = data?.verifications.filter((v) => v.status === "pending").length ?? 0
  const where = [item.org.city, item.org.state].filter(Boolean).join(", ")

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-navy lg:hidden">
        <ArrowLeft size={16} aria-hidden="true" /> All freelancers
      </button>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white shadow-[0_8px_30px_rgba(15,23,40,0.18)]">
        <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-orange/25 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 px-5 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <AnonAvatar code={item.org.display_name} size={56} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[22px] font-bold leading-tight">{item.org.display_name}</h2>
                <Chip tone={chip.tone}>{chip.text}</Chip>
                {item.org.is_demo && <Chip tone="line">Demo</Chip>}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[14px] text-white/75">
                <Lock size={13} className="shrink-0 text-orange" aria-hidden="true" />
                <span>Real name, only MPI sees it:</span> <b className="text-white">{p.legal_name || item.org.name}</b>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13.5px] text-white/65">
                {where && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} aria-hidden="true" /> {where}
                  </span>
                )}
                {p.submitted_at && <span>Sent {ago(p.submitted_at)}</span>}
                {p.reviewed_at && <span>Last reviewed {day(p.reviewed_at, true)}</span>}
              </p>
            </div>
          </div>
          {ready && (
            <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3 xl:max-w-72">
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                {ready.ready ? <CircleCheck size={16} className="text-orange" aria-hidden="true" /> : <CircleAlert size={16} className="text-orange" aria-hidden="true" />}
                {ready.ready ? "Everything needed is filled in" : `${ready.done} of ${ready.items.length} filled in`}
              </p>
              {!ready.ready && (
                <p className="mt-1 text-[13px] text-white/70">Missing: {ready.items.filter((i) => !i.done).map((i) => i.label.toLowerCase()).join(", ")}</p>
              )}
            </div>
          )}
        </div>
        {changesAsked(p) && p.status_note && (
          <p className="relative border-t border-white/10 px-5 py-2.5 text-[13.5px] text-white/80 sm:px-6">
            <b className="text-white">Changes asked:</b> "{p.status_note}"
          </p>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {!data ? (
        !error && <div className="h-96 animate-pulse rounded-xl bg-page" aria-label="Loading" />
      ) : (
        <>
          <TabBar<Tab>
            label="Freelancer details"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "profile", label: "As startups see it" },
              { id: "checks", label: "Checks", count: pendingChecks || undefined },
              { id: "private", label: "Private details" },
            ]}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
              {tab === "profile" && <PublicProfile f={fromOwnProfile(data, item.org.display_name, item.org.city, item.org.state, categoryName)} />}
              {tab === "checks" && <ChecksTab data={data} onDone={done} />}
              {tab === "private" && <PrivateTab data={data} pan={priv.pan} email={priv.email} />}
            </motion.div>
          </AnimatePresence>
          <DecisionBar orgId={orgId} filter={filter} ready={ready?.ready ?? false} name={item.org.display_name} onDone={done} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- decision bar

function DecisionBar({ orgId, filter, ready, name, onDone }: { orgId: string; filter: ReturnType<typeof filterOf>; ready: boolean; name: string; onDone: (msg: string) => Promise<void> }) {
  const [mode, setMode] = useState<"idle" | "changes" | "suspend">("idle")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canApprove = filter === "review" || filter === "suspended"
  const canAskChanges = filter === "review" || filter === "live"
  const canSuspend = filter !== "suspended"

  async function decide(decision: "approve" | "changes" | "suspend") {
    if (decision === "changes" && !note.trim()) {
      setError("Write what the freelancer should change.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await reviewProvider(orgId, decision, note.trim() || undefined)
      setMode("idle")
      setNote("")
      await onDone(decision === "approve" ? `${name} is live` : decision === "changes" ? "Sent back to the freelancer" : `${name} is suspended`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const waitingText =
    filter === "changes" ? "Waiting for the freelancer to make the changes and send it again." : filter === "drafts" ? "Not sent for review yet." : filter === "paused" ? "The freelancer paused new work." : null

  return (
    <div className="sticky bottom-3 z-10 rounded-xl border-[1.5px] border-line bg-white/95 p-3 shadow-[0_8px_24px_rgba(21,35,61,0.14)] backdrop-blur">
      <AnimatePresence mode="wait" initial={false}>
        {mode === "idle" ? (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-[13.5px] text-muted">
              {waitingText ?? (canApprove && !ready ? "Approve unlocks once everything needed is filled in." : filter === "live" ? "Live: startups can find this freelancer." : "Decide on this profile.")}
            </p>
            {canSuspend && (
              <Button variant="ghost" className="min-h-10 px-3 text-[14px] text-red-text" onClick={() => setMode("suspend")}>
                <ShieldOff size={16} aria-hidden="true" /> Suspend
              </Button>
            )}
            {canAskChanges && (
              <Button variant="secondary" className="min-h-10 px-4 text-[14px]" onClick={() => setMode("changes")}>
                <MessageSquareText size={16} aria-hidden="true" /> Ask for changes
              </Button>
            )}
            {canApprove && (
              <Button className="min-h-10 px-4 text-[14px]" busy={busy} disabled={!ready} onClick={() => void decide("approve")}>
                <Rocket size={16} aria-hidden="true" /> {filter === "suspended" ? "Lift suspension and go live" : "Approve and go live"}
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
            <label className="block">
              <span className="mb-1 block text-[14px] font-semibold text-navy">
                {mode === "changes" ? "What should the freelancer change? They see this note." : "Why suspend? The freelancer sees this note (optional)."}
              </span>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={mode === "changes" ? "e.g. Please add the result of your snack store project." : ""}
                className={`${BOX} ${boxBorder(error)} min-h-20 py-2 text-[14.5px]`}
              />
            </label>
            {mode === "changes" && filter === "live" && <p className="text-[13px] text-muted">This takes the profile off the startup list until the freelancer sends it again.</p>}
            {mode === "suspend" && <p className="text-[13px] text-red-text">Startups won't see this freelancer and they can't take new work until you lift it.</p>}
            {error && <Alert>{error}</Alert>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" className="min-h-10 px-4 text-[14px]" onClick={() => { setMode("idle"); setError(null) }}>
                Cancel
              </Button>
              {mode === "changes" ? (
                <Button className="min-h-10 px-4 text-[14px]" busy={busy} onClick={() => void decide("changes")}>
                  Send to the freelancer
                </Button>
              ) : (
                <Button variant="danger" className="min-h-10 px-4 text-[14px]" busy={busy} onClick={() => void decide("suspend")}>
                  Yes, suspend
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
