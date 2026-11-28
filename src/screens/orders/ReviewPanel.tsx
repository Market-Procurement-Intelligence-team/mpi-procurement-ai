/**
 * After a service order is completed:
 * - Startup: rate the provider 1 to 5 stars, pick quick tags, write a short
 *   note (once). Then "Book again" opens a new brief with this freelancer
 *   picked.
 * - Provider: the review it got.
 * Reviews never show who wrote them; the average shows on the provider's
 * anonymous profile and the Providers list.
 */

import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Repeat, Star } from "lucide-react"
import { getOrderReview, leaveReview, REVIEW_TAGS, type ReviewNote, type ReviewTag } from "../../services/data/milestones"
import { getFreelancer } from "../../services/data/providers"
import Button from "../../ui/Button"
import { Alert, BOX, boxBorder } from "../../ui/form"
import { day, errorText } from "../supplier/parts"

export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? "fill-orange text-orange" : "text-line"} aria-hidden="true" />
      ))}
    </span>
  )
}

function ReviewView({ r, mine }: { r: ReviewNote; mine: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-navy">
        <Stars value={r.rating} /> {mine ? "Your review" : "The startup's review"} · {day(r.created_at)}
      </p>
      {r.tags.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {r.tags.map((t) => (
            <span key={t} className="rounded-full bg-navy px-2.5 py-0.5 text-[12.5px] font-semibold text-white">
              {REVIEW_TAGS[t]}
            </span>
          ))}
        </p>
      )}
      {r.note && <p className="text-[14.5px] text-navy">"{r.note}"</p>}
    </div>
  )
}

export default function ReviewPanel({
  orderId,
  vendorOrgId,
  side,
  onDone,
}: {
  orderId: string
  vendorOrgId: string
  side: "startup" | "vendor"
  onDone: (msg: string) => Promise<void>
}) {
  const [review, setReview] = useState<ReviewNote | null | undefined>(undefined)
  const [canBookAgain, setCanBookAgain] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [tags, setTags] = useState<ReviewTag[]>([])
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    getOrderReview(orderId)
      .then((r) => alive && setReview(r))
      .catch(() => alive && setReview(null))
    if (side === "startup") {
      getFreelancer(vendorOrgId)
        .then((f) => alive && setCanBookAgain(f !== null))
        .catch(() => undefined)
    }
    return () => {
      alive = false
    }
  }, [orderId, vendorOrgId, side])

  if (review === undefined) return null
  if (side === "vendor" && !review) return null

  const bookAgain = canBookAgain && (
    <Button variant="secondary" onClick={() => navigate(`/startup/requests/new?kind=service&picks=${vendorOrgId}`)}>
      <Repeat size={16} aria-hidden="true" /> Book again
    </Button>
  )

  return (
    <section className="rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-4 sm:p-5" aria-label="Review">
      {review ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <ReviewView r={review} mine={side === "startup"} />
          {bookAgain}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-red-text">Order completed</p>
            <p className="mt-1 text-[16px] font-bold text-navy">How was working with this provider?</p>
            <p className="text-[13px] text-muted">Your review helps other startups. It never shows your name.</p>
            <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className="rounded p-0.5"
                >
                  <Star size={30} className={n <= (hover || rating) ? "fill-orange text-orange" : "text-line"} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(Object.keys(REVIEW_TAGS) as ReviewTag[]).map((t) => {
                const on = tags.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
                    className={`min-h-9 rounded-full px-3 text-[13.5px] font-semibold ${on ? "bg-navy text-white" : "border-[1.5px] border-line bg-white text-navy hover:border-navy"}`}
                  >
                    {REVIEW_TAGS[t]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor={`rv-${orderId}`} className="mb-1.5 block text-sm font-semibold text-navy">
                A short note <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea
                id={`rv-${orderId}`}
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What went well, or what could be better"
                className={`${BOX} ${boxBorder()} py-2.5`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={rating === 0 || busy}
                busy={busy}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    await leaveReview(orderId, rating, tags, note.trim() || null)
                    setReview(await getOrderReview(orderId))
                    await onDone("Thanks. Your review is saved.")
                  } catch (err) {
                    setError(errorText(err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Star size={16} aria-hidden="true" /> Send review
              </Button>
              {bookAgain}
            </div>
            {error && <Alert>{error}</Alert>}
          </div>
        </div>
      )}
    </section>
  )
}
