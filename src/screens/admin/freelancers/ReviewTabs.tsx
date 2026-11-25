/**
 * Two tabs of the admin freelancer review panel:
 * - ChecksTab: each check (PAN, bank, GST, Udyam, certificate) with the
 *   freelancer's note on where the proof is, and Verify / Reject. A
 *   certificate can get an expiry date. Verifying the bank also marks the
 *   payout as ready (done in the database).
 * - PrivateTab: what only MPI sees: legal name, PAN, payout reference, past
 *   client and company names, and links.
 */

import { useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { BadgeCheck, Building2, CircleCheck, CircleX, Clock, ExternalLink, FileBadge, Landmark, Lock, Receipt, ShieldCheck, type LucideIcon } from "lucide-react"
import {
  reviewVerification,
  VERIFICATION_LABEL,
  type MyProviderProfile,
  type ProviderVerification,
  type VerificationKind,
} from "../../../services/data/providers"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import { Chip, day, errorText } from "../../supplier/parts"

const KINDS: { kind: VerificationKind; icon: LucideIcon; needed: string }[] = [
  { kind: "identity_pan", icon: ShieldCheck, needed: "Needed before the first payout." },
  { kind: "bank", icon: Landmark, needed: "Needed before the first payout. Verifying it marks payouts as ready." },
  { kind: "gst", icon: Receipt, needed: "Optional for freelancers." },
  { kind: "udyam", icon: Building2, needed: "Optional. No MSME badge without it." },
  { kind: "credential", icon: FileBadge, needed: "Optional. Shows as a tick on the profile." },
]

const PILL: Record<string, { text: string; tone: "navy" | "orange" | "red" | "line" | "green"; icon: LucideIcon }> = {
  verified: { text: "Verified", tone: "green", icon: CircleCheck },
  pending: { text: "Waiting for MPI", tone: "orange", icon: Clock },
  rejected: { text: "Rejected", tone: "red", icon: CircleX },
  expired: { text: "Expired", tone: "line", icon: Clock },
}

const PAYOUT: Record<string, string> = {
  not_started: "Payouts: bank not sent",
  pending: "Payouts: bank to check",
  verified: "Payouts: ready",
  rejected: "Payouts: bank rejected",
}

// ---------------------------------------------------------------- checks

export function ChecksTab({ data, onDone }: { data: MyProviderProfile; onDone: (msg: string) => Promise<void> }) {
  const latest = (kind: VerificationKind) => data.verifications.find((v) => v.kind === kind) ?? null
  const payout = data.profile.payout_status
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-muted">The freelancer says where the proof is. Check it, then verify or reject.</p>
        <Chip tone={payout === "verified" ? "green" : payout === "rejected" ? "red" : "line"}>
          <BadgeCheck size={13} aria-hidden="true" /> {PAYOUT[payout] ?? payout}
        </Chip>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {KINDS.map((k) => (
          <CheckRow key={k.kind} meta={k} v={latest(k.kind)} onDone={onDone} />
        ))}
      </div>
    </div>
  )
}

function CheckRow({ meta, v, onDone }: { meta: (typeof KINDS)[number]; v: ProviderVerification | null; onDone: (msg: string) => Promise<void> }) {
  const [mode, setMode] = useState<"idle" | "verify" | "reject">("idle")
  const [note, setNote] = useState("")
  const [expires, setExpires] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pill = v ? PILL[v.status] : null
  const title = VERIFICATION_LABEL[meta.kind]
  const isCredential = meta.kind === "credential"

  async function decide(status: "verified" | "rejected") {
    if (status === "rejected" && !note.trim()) {
      setError("Say why, so the freelancer can fix it.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await reviewVerification(v!.id, status, note.trim() || undefined, expires || undefined)
      setMode("idle")
      setNote("")
      await onDone(status === "verified" ? `${title} verified` : `${title} rejected`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-xl border-[1.5px] bg-white p-4 ${v?.status === "pending" ? "border-orange/60" : "border-line/70"}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-orange">
          <meta.icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[15.5px] font-bold text-navy">{title}</span>
            {pill ? (
              <Chip tone={pill.tone}>
                <pill.icon size={13} aria-hidden="true" /> {pill.text}
              </Chip>
            ) : (
              <Chip>Not sent</Chip>
            )}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">{meta.needed}</p>
          {v && (
            <dl className="mt-2 space-y-0.5 text-[13.5px] text-ink">
              <div>
                <dt className="inline font-semibold text-navy">Proof: </dt>
                <dd className="inline">{v.evidence_ref || "No note given"}</dd>
              </div>
              <div className="text-muted">
                Sent {day(v.created_at, true)}
                {v.verified_at && v.status === "verified" ? ` · verified ${day(v.verified_at, true)}` : ""}
                {v.expires_at ? ` · expires ${day(v.expires_at, true)}` : ""}
              </div>
              {v.note && v.status !== "pending" && (
                <div>
                  <dt className="inline font-semibold text-navy">MPI note: </dt>
                  <dd className="inline">{v.note}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

      {v?.status === "pending" && (
        <div className="mt-3 border-t border-line/70 pt-3">
          <AnimatePresence initial={false} mode="wait">
            {mode === "idle" ? (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2">
                <Button variant="secondary" className="min-h-10 px-4 text-[14px]" onClick={() => (isCredential ? setMode("verify") : void decide("verified"))} busy={busy}>
                  <CircleCheck size={16} aria-hidden="true" /> Verify
                </Button>
                <Button variant="ghost" className="min-h-10 px-4 text-[14px] text-red-text" onClick={() => setMode("reject")}>
                  <CircleX size={16} aria-hidden="true" /> Reject
                </Button>
              </motion.div>
            ) : (
              <motion.div key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
                {mode === "verify" && (
                  <label className="block">
                    <span className="mb-1 block text-[13.5px] font-semibold text-navy">Expires on (optional)</span>
                    <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={`${BOX} ${boxBorder()} min-h-10 max-w-56 text-[14.5px]`} />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-[13.5px] font-semibold text-navy">{mode === "reject" ? "Why? The freelancer sees this" : "Note (optional)"}</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder={mode === "reject" ? "e.g. The PAN name doesn't match the legal name" : ""}
                    className={`${BOX} ${boxBorder(error)} min-h-16 py-2 text-[14.5px]`}
                  />
                </label>
                {error && <Alert>{error}</Alert>}
                <div className="flex flex-wrap gap-2">
                  <Button className="min-h-10 px-4 text-[14px]" busy={busy} onClick={() => void decide(mode === "verify" ? "verified" : "rejected")}>
                    {mode === "verify" ? "Verify" : "Reject check"}
                  </Button>
                  <Button variant="ghost" className="min-h-10 px-4 text-[14px]" onClick={() => { setMode("idle"); setError(null) }}>
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- private

export function PrivateTab({ data, pan, email }: { data: MyProviderProfile; pan: string | null; email: string | null }) {
  const p = data.profile
  const clients = data.projects.filter((x) => x.client_name || x.link)
  const companies = data.experience.filter((x) => x.company_name)
  const links = data.credentials.filter((x) => x.link)
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-lg bg-navy-tint px-3 py-2 text-[13.5px] font-semibold text-navy">
        <Lock size={15} className="text-orange-2" aria-hidden="true" /> Only MPI sees this page. Startups never see these details.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Legal name" value={p.legal_name} />
        <Fact label="PAN" value={pan} mono />
        <Fact label="Payout reference" value={p.payout_reference} mono />
        <Fact label="Login email" value={email} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <Block title="Past clients" empty="No client names or links given.">
          {clients.map((x) => (
            <Line key={x.id} main={x.client_name ?? x.client_kind ?? "Client not named"} sub={x.title} link={x.link} />
          ))}
        </Block>
        <Block title="Companies worked at" empty="No company names given.">
          {companies.map((x) => (
            <Line key={x.id} main={x.company_name!} sub={x.role_title} />
          ))}
        </Block>
        <Block title="Certificate links" empty="No certificate links given.">
          {links.map((x) => (
            <Line key={x.id} main={x.title} sub={x.issuer} link={x.link} />
          ))}
        </Block>
      </div>
    </div>
  )
}

function Fact({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-line/70 bg-white px-4 py-3">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 break-words text-[15px] font-semibold text-navy ${mono ? "font-mono tracking-wide" : ""}`}>{value || "Not given"}</p>
    </div>
  )
}

function Block({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section className="rounded-xl border border-line/70 bg-white">
      <h3 className="border-b border-line/70 px-4 py-2.5 text-[14px] font-bold text-navy" style={{ background: "#eef1f5" }}>
        {title}
      </h3>
      {children.length ? <ul className="divide-y divide-line/60">{children}</ul> : <p className="px-4 py-3 text-[13.5px] text-muted">{empty}</p>}
    </section>
  )
}

function Line({ main, sub, link }: { main: string; sub?: string | null; link?: string | null }) {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-navy">{main}</span>
        {sub && <span className="block text-[13px] text-muted">{sub}</span>}
      </span>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-navy underline underline-offset-2 hover:text-orange-2">
          Open <ExternalLink size={13} aria-hidden="true" />
        </a>
      )}
    </li>
  )
}
