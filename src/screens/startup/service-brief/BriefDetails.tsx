/**
 * A sent service brief on the startup's request page ("Your brief" tab):
 * deliverables with "done when", and the facts on the right.
 */

import { useEffect, useState } from "react"
import { CircleCheck, ExternalLink, Lock } from "lucide-react"
import type { Category } from "../../../services/data/catalogue"
import { listSkills, type Skill } from "../../../services/data/providers"
import { deliverablesOf, type ProviderPreference, type Request } from "../../../services/data/requests"
import { day, daysLeft, place } from "../../supplier/parts"
import { RequestSchemeChips } from "../../schemes/parts"
import { PROVIDER_LABEL } from "./brief"

export default function BriefDetails({ request, category, budget }: { request: Request; category: Category | undefined; budget: string | null }) {
  const [skills, setSkills] = useState<Skill[]>([])
  useEffect(() => {
    if (request.skill_ids?.length) listSkills().then(setSkills).catch(() => setSkills([]))
  }, [request.skill_ids])
  const deliverables = deliverablesOf(request)
  const skillNames = (request.skill_ids ?? []).map((id) => skills.find((s) => s.id === id)?.name).filter(Boolean) as string[]
  const rows: [string, string][] = [
    ["Kind of service", category?.name ?? "Not set"],
    ["Deadline", request.needed_by ? `${day(request.needed_by, true)} (${daysLeft(request.needed_by)})` : "Not set"],
    ["Where", place(request.delivery_city, request.delivery_state) ?? "Online, anywhere in India"],
    ["Changes", request.revision_rounds != null ? `${request.revision_rounds} round${request.revision_rounds === 1 ? "" : "s"}` : "Not set"],
    ["Providers", PROVIDER_LABEL[(request.provider_preference as ProviderPreference) ?? "any"] ?? "Any provider"],
    ["Proposals", request.proposals_wanted === 3 ? "Up to 3" : String(request.proposals_wanted)],
    ["Sent", day(request.created_at, true) ?? ""],
  ]
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-xl border-[1.5px] border-line bg-white soft-panel">
          <h3 className="bg-navy px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-white">Deliverables</h3>
          <ol className="divide-y divide-line/70">
            {deliverables.map((d, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[12px] font-bold text-navy">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-navy">{d.title}</span>
                  {d.done_when && (
                    <span className="mt-0.5 flex items-start gap-1.5 text-[13.5px] text-muted">
                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" /> Done when: {d.done_when}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
        {request.description && (
          <div className="rounded-xl border-[1.5px] border-line bg-white soft-panel p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Goal</p>
            <p className="mt-1 whitespace-pre-line text-[14.5px] text-navy">{request.description}</p>
          </div>
        )}
        {(skillNames.length > 0 || (request.reference_links ?? []).length > 0) && (
          <div className="rounded-xl border-[1.5px] border-line bg-white soft-panel p-4">
            {skillNames.length > 0 && (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Skills needed</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {skillNames.map((n) => (
                    <span key={n} className="rounded-full bg-navy-tint px-2.5 py-0.5 text-[13px] font-semibold text-navy">
                      {n}
                    </span>
                  ))}
                </div>
              </>
            )}
            {(request.reference_links ?? []).length > 0 && (
              <>
                <p className={`text-[12px] font-semibold uppercase tracking-[0.05em] text-muted ${skillNames.length ? "mt-3" : ""}`}>Reference links</p>
                <ul className="mt-1.5 space-y-1">
                  {request.reference_links.map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-[14px] font-semibold text-navy underline underline-offset-2 hover:text-orange-2">
                        <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{l}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {request.requirement_text && (
          <div className="rounded-xl border-[1.5px] border-line bg-white soft-panel p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">In your words</p>
            <p className="mt-1 whitespace-pre-line text-[14.5px] text-navy">{request.requirement_text}</p>
          </div>
        )}
      </div>
      <dl className="h-fit overflow-hidden rounded-xl border-[1.5px] border-line bg-white soft-panel text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr] border-b border-line last:border-b-0">
            <dt className="bg-navy-tint/60 px-3 py-2.5 font-semibold text-navy">{k}</dt>
            <dd className="px-3 py-2.5 text-navy">{v}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[7.5rem_1fr] border-b border-line">
          <dt className="bg-navy-tint/60 px-3 py-2.5 font-semibold text-navy">Schemes</dt>
          <dd className="px-3 py-2.5 text-navy">
            <RequestSchemeChips ids={request.scheme_ids ?? []} linkBase="/startup/schemes" empty="None chosen" />
          </dd>
        </div>
        <div className="grid grid-cols-[7.5rem_1fr]">
          <dt className="bg-orange-tint px-3 py-2.5 font-semibold text-navy">Budget</dt>
          <dd className="px-3 py-2.5 text-navy">
            {budget ?? "Not given"}
            <span className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
              <Lock size={12} aria-hidden="true" /> Private to you and MPI
            </span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
