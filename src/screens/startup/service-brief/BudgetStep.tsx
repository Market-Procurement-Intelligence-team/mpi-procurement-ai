/**
 * Brief step 3, "Budget & providers": the private budget range, which kind of
 * provider the startup wants, and how many proposals (up to 3).
 */

import { Link } from "react-router"
import { BadgeCheck, Bookmark, Info, Lock, Plus, Users, Wallet, X } from "lucide-react"
import { MAX_PICKS, type FreelancerCard } from "../../../services/data/providers"
import { BOX, boxBorder, Field } from "../../../ui/form"
import { AnonAvatar } from "../../freelancer/PublicProfile"
import { Segmented } from "../../freelancer/ui"
import { rupees } from "../../supplier/parts"
import type { Errors } from "../new-request/draft"
import type { ServiceDraft } from "./brief"
import { CARD, StepTitle } from "./parts"

const PROVIDER_HINT = {
  any: "MPI suggests the best fit: a business or a freelancer.",
  business: "Registered MSMEs and agencies, checked by MPI.",
  freelancer: "Individual professionals with a profile checked by MPI.",
} as const

export default function BudgetStep({
  draft,
  update,
  errors,
  freelancersOn,
  directory = [],
  shortlist = [],
}: {
  draft: ServiceDraft
  update: (patch: Partial<ServiceDraft>) => void
  errors: Errors
  freelancersOn: boolean
  /** Live freelancers the startup can see (anonymous). */
  directory?: FreelancerCard[]
  /** The startup's shortlist (org ids). */
  shortlist?: string[]
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section className={CARD}>
        <StepTitle icon={Wallet} title="Your budget" aside="Optional" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="From (₹)" error={errors.budgetMin}>
            {(a) => (
              <input {...a} inputMode="numeric" value={draft.budgetMin} onChange={(e) => update({ budgetMin: e.target.value.replace(/[^\d,]/g, "") })} placeholder="15,000" className={`${BOX} ${boxBorder(errors.budgetMin)} h-12 tabular-nums`} />
            )}
          </Field>
          <Field label="Up to (₹)" error={errors.budgetMax}>
            {(a) => (
              <input {...a} inputMode="numeric" value={draft.budgetMax} onChange={(e) => update({ budgetMax: e.target.value.replace(/[^\d,]/g, "") })} placeholder="30,000" className={`${BOX} ${boxBorder(errors.budgetMax)} h-12 tabular-nums`} />
            )}
          </Field>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-lg bg-navy p-4 text-white">
          <Lock size={20} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
          <p className="text-[15px] leading-relaxed">
            <strong className="font-semibold">Providers never see your budget.</strong> MPI uses it only to find providers whose prices fit, and it helps
            you compare proposals.
          </p>
        </div>
      </section>

      <section className={CARD}>
        <StepTitle icon={Users} title="Who should send proposals" />
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-navy">Kind of provider</p>
            <Segmented
              label="Kind of provider"
              value={draft.providerPreference}
              onChange={(v) => update({ providerPreference: v })}
              options={[
                { value: "any", label: "Any" },
                { value: "business", label: "Businesses" },
                { value: "freelancer", label: "Freelancers" },
              ]}
            />
            <p className="mt-1.5 text-sm text-muted">{PROVIDER_HINT[draft.providerPreference]}</p>
            {!freelancersOn && draft.providerPreference === "freelancer" && (
              <p className="mt-2 flex items-start gap-2 rounded-md bg-orange-tint px-3 py-2 text-[14px] text-navy">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Freelancers aren't open on MPI yet, so MPI will suggest businesses for now.
              </p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-navy">How many proposals you want</p>
            <Segmented
              label="How many proposals"
              value={String(draft.proposalsWanted) as "1" | "2" | "3"}
              onChange={(v) => update({ proposalsWanted: Number(v) })}
              options={[
                { value: "1", label: "1" },
                { value: "2", label: "2" },
                { value: "3", label: "Up to 3" },
              ]}
            />
            <p className="mt-1.5 text-sm text-muted">Fewer, better proposals save you time.</p>
          </div>
          {freelancersOn ? (
            <YourShortlist draft={draft} update={update} directory={directory} shortlist={shortlist} />
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-line/70 bg-white px-3 py-2.5 text-[14px] text-navy">
              <BadgeCheck size={17} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
              MPI suggests providers who fit and checks each one before they see your brief.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

/** Shortlisted freelancers sent with the brief (up to 3), next to MPI's own suggestions. */
function YourShortlist({
  draft,
  update,
  directory,
  shortlist,
}: {
  draft: ServiceDraft
  update: (patch: Partial<ServiceDraft>) => void
  directory: FreelancerCard[]
  shortlist: string[]
}) {
  const byId = new Map(directory.map((c) => [c.id ?? "", c]))
  const picked = draft.picks.map((id) => byId.get(id)).filter((c): c is FreelancerCard => Boolean(c))
  const more = shortlist.filter((id) => !draft.picks.includes(id) && byId.has(id)).map((id) => byId.get(id)!)
  const businessOnly = draft.providerPreference === "business"
  const full = picked.length >= MAX_PICKS
  const remove = (id: string) => update({ picks: draft.picks.filter((x) => x !== id) })
  const add = (id: string) => !full && update({ picks: [...draft.picks, id] })

  return (
    <div className="rounded-lg border border-line/70 bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
          <Bookmark size={16} aria-hidden="true" /> Your shortlist
        </p>
        <span className="text-[13px] text-muted">
          {picked.length} of {MAX_PICKS}
        </span>
      </div>

      {businessOnly && picked.length > 0 ? (
        <p className="mt-2 flex items-start gap-2 rounded-md bg-orange-tint px-3 py-2 text-[13.5px] text-navy">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          Your picks are freelancers. Choose Any or Freelancers above to send them with this brief.
        </p>
      ) : null}

      {picked.length > 0 && (
        <ul className={`mt-2.5 space-y-2 ${businessOnly ? "opacity-50" : ""}`}>
          {picked.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 rounded-md bg-page px-2.5 py-2">
              <AnonAvatar code={c.display_name ?? ""} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-navy">{c.display_name}</span>
                <span className="block truncate text-[12.5px] text-muted">
                  {c.headline}
                  {c.starting_price !== null ? ` · from ${rupees(Number(c.starting_price))}` : ""}
                </span>
              </span>
              <button type="button" onClick={() => remove(c.id ?? "")} className="rounded-md p-1.5 text-muted hover:bg-red-tint hover:text-red-text" aria-label={`Remove ${c.display_name} from this brief`}>
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {more.length > 0 && !full && !businessOnly && (
        <div className="mt-2.5">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.05em] text-muted">Add from your shortlist</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {more.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(c.id ?? "")}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border-[1.5px] border-input bg-white px-3 text-[13px] font-semibold text-navy hover:border-navy"
              >
                <Plus size={14} aria-hidden="true" /> {c.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {picked.length === 0 && more.length === 0 && (
        <p className="mt-1.5 text-[13.5px] text-muted">
          Want someone in particular?{" "}
          <Link to="/startup/providers" className="font-semibold text-navy underline underline-offset-2">
            Browse freelancers
          </Link>{" "}
          and shortlist them. Your brief is kept while you look.
        </p>
      )}

      <p className="mt-2.5 flex items-start gap-1.5 text-[13px] text-muted">
        <BadgeCheck size={15} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
        MPI also suggests providers who fit, and checks every one before they see your brief.
      </p>
    </div>
  )
}
