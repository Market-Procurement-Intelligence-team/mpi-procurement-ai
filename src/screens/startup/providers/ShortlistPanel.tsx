/**
 * The startup's shortlist: saved freelancers, with a choice of up to 3 to
 * send to MPI with a new or a draft service brief. MPI still approves every
 * match before a freelancer sees the brief.
 */

import { useState } from "react"
import { useNavigate } from "react-router"
import { Bookmark, CircleCheck, FilePlus2, Trash2 } from "lucide-react"
import { MAX_PICKS, type FreelancerCard } from "../../../services/data/providers"
import Button from "../../../ui/Button"
import { AnonAvatar } from "../../freelancer/PublicProfile"
import { rupees } from "../../supplier/parts"
import Panel from "./Panel"

export interface DraftBrief {
  id: string
  title: string
}

const BRIEF = "/startup/requests/new?kind=service"

export default function ShortlistPanel({
  cards,
  drafts,
  busyId,
  onRemove,
  onOpen,
  onClose,
}: {
  cards: FreelancerCard[]
  drafts: DraftBrief[]
  busyId: string | null
  onRemove: (id: string) => void
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [chosen, setChosen] = useState<string[]>(() => cards.slice(0, MAX_PICKS).map((c) => c.id ?? ""))
  const [draft, setDraft] = useState("")
  const picks = chosen.filter((id) => cards.some((c) => c.id === id))
  const full = picks.length >= MAX_PICKS

  const toggle = (id: string) =>
    setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length >= MAX_PICKS ? list : [...list, id]))
  const go = (draftId?: string) =>
    navigate(`${BRIEF}${draftId ? `&draft=${draftId}` : ""}&picks=${picks.join(",")}`)

  return (
    <Panel
      title={`Your shortlist (${cards.length})`}
      subtitle={`Pick up to ${MAX_PICKS} to send with a brief. MPI approves every invite.`}
      onClose={onClose}
      footer={
        cards.length > 0 && (
          <>
            {drafts.length > 0 && (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <select
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Draft brief to add these to"
                  className="min-h-11 min-w-0 flex-1 rounded-md border-[1.5px] border-input bg-white px-3 text-[14.5px] text-navy focus:border-orange focus:outline-none"
                >
                  <option value="">Add to a draft brief…</option>
                  {drafts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" disabled={!draft || picks.length === 0} onClick={() => go(draft)}>
                  Add
                </Button>
              </div>
            )}
            <Button className="ml-auto" disabled={picks.length === 0} onClick={() => go()}>
              <FilePlus2 size={17} aria-hidden="true" />
              Start a new brief
            </Button>
          </>
        )
      }
    >
      {cards.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border-[1.5px] border-dashed border-line bg-white px-6 py-12 text-center">
          <span className="rounded-full bg-navy-tint p-3 text-navy">
            <Bookmark size={24} aria-hidden="true" />
          </span>
          <p className="mt-3 font-semibold text-navy">Nothing shortlisted yet</p>
          <p className="mt-1 max-w-xs text-[14px] text-muted">Press Shortlist on a provider you like. They stay here until you remove them.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13.5px] text-muted">
            {picks.length} of {MAX_PICKS} chosen for the brief{full ? " (the most a brief can have)" : ""}.
          </p>
          <ul className="space-y-2.5">
            {cards.map((c) => {
              const id = c.id ?? ""
              const on = picks.includes(id)
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-xl bg-white p-3"
                  style={{ border: on ? "1.5px solid #ec8d49" : "1.5px solid #e2e6ee" }}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && full}
                      onChange={() => toggle(id)}
                      className="size-5 shrink-0 accent-[#15233d]"
                      aria-label={`Choose ${c.display_name} for the brief`}
                    />
                    <AnonAvatar code={c.display_name ?? ""} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-navy">{c.display_name}</span>
                      <span className="block truncate text-[13px] text-muted">{c.headline}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-muted">
                        {c.starting_price !== null && <span>From {rupees(Number(c.starting_price))}</span>}
                        {c.usual_delivery_days !== null && <span>~{c.usual_delivery_days} days</span>}
                        {on && (
                          <span className="inline-flex items-center gap-1 font-semibold text-navy">
                            <CircleCheck size={13} aria-hidden="true" /> In the brief
                          </span>
                        )}
                      </span>
                    </span>
                  </label>
                  <button type="button" onClick={() => onOpen(id)} className="shrink-0 rounded-md px-2 py-1.5 text-[13.5px] font-semibold text-navy underline-offset-2 hover:underline">
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(id)}
                    disabled={busyId === id}
                    className="shrink-0 rounded-md p-2 text-muted hover:bg-red-tint hover:text-red-text disabled:opacity-50"
                    aria-label={`Remove ${c.display_name} from the shortlist`}
                  >
                    <Trash2 size={17} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Panel>
  )
}
