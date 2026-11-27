/**
 * Brief step 3, "Budget & providers": the private budget range, which kind of
 * provider the startup wants, and how many proposals (up to 3).
 */

import { BadgeCheck, Info, Lock, Users, Wallet } from "lucide-react"
import { BOX, boxBorder, Field } from "../../../ui/form"
import { Segmented } from "../../freelancer/ui"
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
}: {
  draft: ServiceDraft
  update: (patch: Partial<ServiceDraft>) => void
  errors: Errors
  freelancersOn: boolean
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
          <p className="flex items-start gap-2 rounded-lg border border-line/70 bg-white px-3 py-2.5 text-[14px] text-navy">
            <BadgeCheck size={17} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" />
            MPI suggests providers who fit and checks each one before they see your brief. Picking providers from their profiles is coming soon.
          </p>
        </div>
      </section>
    </div>
  )
}
