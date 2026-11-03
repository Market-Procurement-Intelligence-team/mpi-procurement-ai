/**
 * My requests: a simple list for now, so drafts can be continued and sent
 * requests seen. Its full design comes with the next screen.
 */

import { useEffect, useState } from "react"
import { Link } from "react-router"
import { ChevronRight, FileText, Plus } from "lucide-react"
import { useMe } from "../../app/session"
import { listMyRequests, type Request } from "../../services/data/requests"
import Chip, { type ChipTone } from "../../ui/Chip"
import EmptyState from "../../ui/EmptyState"
import { Alert } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"

const STATUS: Record<Request["status"], { label: string; tone: ChipTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Finding suppliers", tone: "waiting" },
  comparing: { label: "Price offers in", tone: "waiting" },
  ordered: { label: "Ordered", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "negative" },
}

const NEW = "/startup/requests/new"

function NewButton() {
  return (
    <Link to={NEW} className="btn-gradient inline-flex min-h-11 items-center gap-2 rounded-md px-5 text-[15px] font-bold text-navy shadow-sm hover:brightness-95">
      <Plus size={18} aria-hidden="true" />
      New request
    </Link>
  )
}

export default function MyRequestsPage() {
  const me = useMe()
  const [requests, setRequests] = useState<Request[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = "My requests · MPI"
    listMyRequests(me.organisation.id)
      .then(setRequests)
      .catch((err) => {
        setRequests([])
        setError(err instanceof Error ? err.message : "Couldn't load your requests.")
      })
  }, [me.organisation.id])

  return (
    <>
      <PageHeader title="My requests" description="Everything you've asked MPI to source." actions={<NewButton />} />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {requests === null ? (
        <ul className="space-y-3" aria-label="Loading requests">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-lg bg-white" />
          ))}
        </ul>
      ) : requests.length === 0 ? (
        !error && (
          <EmptyState
            icon={FileText}
            title="No requests yet"
            body="Describe what you need in your own words, or pick from the catalogue. MPI finds verified suppliers for you."
            action={<NewButton />}
          />
        )
      ) : (
        <ul className="overflow-hidden rounded-lg border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
          {requests.map((r) => {
            const status = STATUS[r.status]
            const to = r.status === "draft" ? `${NEW}?draft=${r.id}` : `/startup/requests/${r.id}`
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-navy">{r.title}</span>
                  <span className="block text-sm text-muted">
                    {r.status === "draft" ? "Saved" : "Sent"}{" "}
                    {new Date(r.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {r.needed_by &&
                      ` · Needed by ${new Date(`${r.needed_by}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                  </span>
                </span>
                <Chip tone={status.tone}>{status.label}</Chip>
                {to && (
                  <span className="hidden items-center gap-1 text-sm font-semibold text-navy sm:flex">
                    {r.status === "draft" ? "Continue" : "Open"}
                    <ChevronRight size={16} aria-hidden="true" />
                  </span>
                )}
              </>
            )
            return (
              <li key={r.id} className="border-b border-line last:border-b-0">
                {to ? (
                  <Link to={to} className="flex min-h-18 items-center gap-4 px-5 py-4 hover:bg-navy-tint/50">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-18 items-center gap-4 px-5 py-4">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
