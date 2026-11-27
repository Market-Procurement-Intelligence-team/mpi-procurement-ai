/**
 * Checks: identity (PAN), bank, GST, Udyam and certificates. The freelancer
 * adds a check with a short reference to the proof; MPI looks at it by hand
 * and marks it verified or not. Verified checks show as ticks to startups.
 * File uploads come later; for now the reference says where MPI can find it.
 */

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { BadgeCheck, Ban, Clock, Landmark, Receipt, ScrollText, ShieldCheck, Undo2, type LucideIcon } from "lucide-react"
import { requestVerification, withdrawVerification, type ProviderVerification, type VerificationKind } from "../../../services/data/providers"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import { day, errorText } from "../../supplier/parts"
import { SectionPanel } from "../ui"
import type { SectionProps } from "./types"

const KINDS: { kind: VerificationKind; title: string; body: string; icon: LucideIcon; optional?: boolean; hint: string }[] = [
  { kind: "identity_pan", title: "Identity (PAN)", body: "Needed before your first payout.", icon: ShieldCheck, hint: "e.g. PAN card emailed to MPI on 25 Nov" },
  { kind: "bank", title: "Bank details", body: "Where MPI sends your money. MPI checks it before your first payout.", icon: Landmark, hint: "e.g. Cancelled cheque emailed to MPI on 25 Nov" },
  { kind: "gst", title: "GST", body: "Optional for freelancers. Add it if you're registered.", icon: Receipt, optional: true, hint: "e.g. GSTIN 27ABCDE1234F1Z5" },
  { kind: "udyam", title: "Udyam", body: "Optional for freelancers. No MSME badge is shown without it.", icon: ScrollText, optional: true, hint: "e.g. UDYAM-MH-00-0000000" },
  { kind: "credential", title: "Certificate", body: "Ask MPI to check a certificate from your profile.", icon: BadgeCheck, optional: true, hint: "e.g. Google UX certificate, link on my profile" },
]

const STATUS: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  pending: { label: "Waiting for MPI", cls: "bg-navy-tint text-navy", icon: Clock },
  verified: { label: "Verified", cls: "bg-[#d1fae5] text-[#065f46]", icon: BadgeCheck },
  rejected: { label: "Not accepted", cls: "bg-red-tint text-red-text", icon: Ban },
  expired: { label: "Expired", cls: "bg-orange-tint text-navy", icon: Clock },
}

export default function Checks({ orgId, b, reload, toast }: SectionProps) {
  const [adding, setAdding] = useState<VerificationKind | null>(null)
  const [ref, setRef] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The latest check of each kind (the list is newest first).
  const latest = new Map<string, ProviderVerification>()
  for (const v of b.data.verifications) if (!latest.has(v.kind)) latest.set(v.kind, v)

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      await reload()
      toast(done)
      setAdding(null)
      setRef("")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const payout = b.data.profile.payout_status
  return (
    <SectionPanel
      icon={ShieldCheck}
      title="Checks"
      subtitle="MPI checks these by hand. Startups see a tick, never the numbers."
      aside={
        <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-bold ${payout === "verified" ? "bg-[#d1fae5] text-[#065f46]" : payout === "rejected" ? "bg-red-tint text-red-text" : "bg-navy-tint text-navy"}`}>
          Payouts: {payout === "verified" ? "ready" : payout === "pending" ? "being checked" : payout === "rejected" ? "bank not accepted" : "add bank details"}
        </span>
      }
    >
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <ul className="grid gap-3 lg:grid-cols-2">
        {KINDS.map((k) => {
          const v = latest.get(k.kind)
          const st = v ? STATUS[v.status] : null
          const canAdd = !v || v.status === "rejected" || v.status === "expired"
          return (
            <li key={k.kind} className="rounded-xl border border-line/70 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy text-orange">
                  <k.icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-navy">{k.title}</span>
                    {k.optional && <span className="text-[12px] font-medium text-muted">Optional</span>}
                    {st ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${st.cls}`}>
                        <st.icon size={12} aria-hidden="true" /> {st.label}
                      </span>
                    ) : (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[12px] font-semibold text-muted">Not added</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13.5px] text-muted">{k.body}</p>
                  {v && (
                    <p className="mt-1.5 text-[13px] text-ink">
                      {v.status === "verified" ? `Verified ${day(v.verified_at, true) ?? ""}${v.expires_at ? ` · valid till ${day(v.expires_at, true)}` : ""}` : `Sent ${day(v.created_at, true)}${v.evidence_ref ? ` · "${v.evidence_ref}"` : ""}`}
                    </p>
                  )}
                  {v?.note && v.status !== "verified" && <p className="mt-1 rounded-md bg-red-tint px-2.5 py-1.5 text-[13px] text-red-text">MPI: {v.note}</p>}
                </div>
                <div className="shrink-0">
                  {canAdd && adding !== k.kind && (
                    <Button variant="secondary" className="min-h-9 px-3 text-[13.5px]" onClick={() => { setAdding(k.kind); setRef(""); setError(null) }}>
                      {v ? "Send again" : "Add"}
                    </Button>
                  )}
                  {v?.status === "pending" && (
                    <button type="button" disabled={busy} onClick={() => void run(() => withdrawVerification(v.id), "Check withdrawn")} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-semibold text-muted hover:bg-navy-tint hover:text-navy">
                      <Undo2 size={15} aria-hidden="true" /> Withdraw
                    </button>
                  )}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {adding === k.kind && (
                  <motion.form
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (ref.trim()) void run(() => requestVerification(orgId, k.kind, ref.trim()), "Sent to MPI")
                    }}
                  >
                    <label className="mt-3 block text-[13.5px] font-semibold text-navy" htmlFor={`ref-${k.kind}`}>
                      Where can MPI find the proof?
                    </label>
                    <input id={`ref-${k.kind}`} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={500} placeholder={k.hint} className={`${BOX} ${boxBorder()} mt-1.5 h-11`} autoFocus />
                    <p className="mt-1 text-[12.5px] text-muted">Don't type full card or account numbers here. Uploading files comes soon.</p>
                    <div className="mt-2.5 flex gap-2">
                      <Button type="submit" busy={busy} disabled={!ref.trim()} className="min-h-9 px-4 text-[13.5px]">
                        Send to MPI
                      </Button>
                      <Button variant="ghost" className="min-h-9 px-3 text-[13.5px]" onClick={() => setAdding(null)}>
                        Cancel
                      </Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </SectionPanel>
  )
}
