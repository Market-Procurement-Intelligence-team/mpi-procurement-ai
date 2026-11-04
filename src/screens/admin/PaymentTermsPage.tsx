/**
 * Admin: Payment terms (/admin/payment-terms).
 *
 * How startups pay suppliers: 30% before work starts and 70% on delivery, or
 * 100% in advance. Set by MPI only; suppliers can't change them.
 * - Platform default: two option cards with a ₹1,00,000 example; changing it
 *   asks to confirm first.
 * - By category: each category uses the default or its own terms. A change
 *   saves straight away.
 * Changes apply to quotes sent from now on. Quotes already sent and orders
 * keep the terms they were made with.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckCircle2, Info, Layers, Search, Wallet } from "lucide-react"
import { getPaymentTerms, PAYMENT_TERMS_LABELS, setCategoryPaymentTerms, setPlatformPaymentTerms, type PaymentTerms, type PaymentTermsSettings } from "../../services/data/admin"
import Button from "../../ui/Button"
import { Alert, BOX, boxBorder } from "../../ui/form"
import PageHeader from "../../ui/PageHeader"
import { Panel } from "../overview/parts"
import { errorText, rupees, useToast } from "../supplier/parts"

const OPTIONS: { id: PaymentTerms; title: string; short: string; body: string; split: [number, number] }[] = [
  {
    id: "30_70",
    title: "30% now, 70% on delivery",
    short: "30 / 70",
    body: "The startup pays 30% when the order is placed so the supplier can start, and the rest once the goods arrive.",
    split: [30, 70],
  },
  {
    id: "full_advance",
    title: "Full advance",
    short: "Full advance",
    body: "The startup pays everything before work starts. Useful for custom or one-off work where the supplier takes more risk.",
    split: [100, 0],
  },
]

const EXAMPLE = 100000

/** A ₹1,00,000 order split into what's paid when. */
function SplitBar({ split }: { split: [number, number] }) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-page" aria-hidden="true">
        <motion.span className="block h-full btn-gradient" initial={{ width: 0 }} animate={{ width: `${split[0]}%` }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} />
        {split[1] > 0 && (
          <motion.span className="block h-full bg-navy" initial={{ width: 0 }} animate={{ width: `${split[1]}%` }} transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[12.5px]">
        <span className="text-navy">
          <b>{rupees((EXAMPLE * split[0]) / 100)}</b> before work starts
        </span>
        {split[1] > 0 && (
          <span className="text-right text-navy">
            <b>{rupees((EXAMPLE * split[1]) / 100)}</b> on delivery
          </span>
        )}
      </div>
    </div>
  )
}

export default function PaymentTermsPage() {
  const [settings, setSettings] = useState<PaymentTermsSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PaymentTerms | null>(null)
  const [savingDefault, setSavingDefault] = useState(false)
  const [savingCat, setSavingCat] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [toast, toastNode] = useToast()

  const reload = useCallback(async () => {
    try {
      setSettings(await getPaymentTerms())
      setError(null)
    } catch (err) {
      setError(errorText(err))
    }
  }, [])

  useEffect(() => {
    document.title = "Payment terms · MPI admin"
    void reload()
  }, [reload])

  const cats = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (settings?.byCategory ?? []).filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [settings, query])
  const own = settings?.byCategory.filter((c) => c.terms).length ?? 0

  const saveDefault = async () => {
    if (!pending) return
    setSavingDefault(true)
    try {
      await setPlatformPaymentTerms(pending)
      toast(`Default changed to ${OPTIONS.find((o) => o.id === pending)?.short}`)
      setPending(null)
      await reload()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSavingDefault(false)
    }
  }

  const saveCategory = async (categoryId: string, name: string, terms: PaymentTerms | null) => {
    setSavingCat(categoryId)
    try {
      await setCategoryPaymentTerms(categoryId, terms)
      toast(`${name}: ${terms ? OPTIONS.find((o) => o.id === terms)?.short : "uses the default"}`)
      await reload()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSavingCat(null)
    }
  }

  return (
    <div>
      <PageHeader title="Payment terms" description="How startups pay suppliers on MPI. Only MPI sets these; suppliers can't change them." />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <p className="mb-5 flex items-start gap-2.5 rounded-lg bg-navy-tint/60 px-3.5 py-3 text-[14px] text-navy">
        <Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Changes apply to <b>quotes sent from now on</b>. Quotes already sent and orders already placed keep the terms they were made with.
        </span>
      </p>

      {!settings ? (
        <div className="space-y-4" aria-label="Loading">
          <div className="h-56 animate-pulse rounded-xl bg-page" />
          <div className="h-80 animate-pulse rounded-xl bg-page" />
        </div>
      ) : (
        <div className="space-y-5">
          <Panel title="Platform default" icon={Wallet}>
            <div className="px-4 py-4 sm:px-5">
              <p className="text-[14px] text-muted">Every category uses this unless you give it its own terms below.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Platform default payment terms">
                {OPTIONS.map((o) => {
                  const current = settings.platform === o.id
                  const chosen = (pending ?? settings.platform) === o.id
                  return (
                    <motion.button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setPending(o.id === settings.platform ? null : o.id)}
                      className="rounded-xl p-4 text-left transition-shadow"
                      style={
                        chosen
                          ? { border: "2.5px solid transparent", background: "linear-gradient(#fff8f1, #fff8f1) padding-box, conic-gradient(from 0deg, #f09a47, #ec8d49, #db4230, #ec8d49, #f09a47) border-box", boxShadow: "0 6px 18px rgba(240,154,71,0.18)" }
                          : { border: "2.5px solid #dfe4eb", background: "#fff" }
                      }
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-display text-[17px] font-bold text-navy">{o.title}</span>
                        {current ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[12px] font-bold text-[#047857]">
                            <CheckCircle2 size={13} aria-hidden="true" /> In use
                          </span>
                        ) : (
                          chosen && <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-[12px] font-bold text-navy">Selected</span>
                        )}
                      </span>
                      <span className="mt-1 block text-[13.5px] text-muted">{o.body}</span>
                      <span className="mt-3 block text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">On a {rupees(EXAMPLE)} order</span>
                      <span className="mt-1.5 block">
                        <SplitBar split={o.split} />
                      </span>
                    </motion.button>
                  )
                })}
              </div>
              <AnimatePresence>
                {pending && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-[1.5px] border-orange bg-orange-tint/40 p-4">
                      <p className="text-[14.5px] text-navy">
                        Change the default to <b>{PAYMENT_TERMS_LABELS[pending]}</b>? {settings.byCategory.length - own} categor{settings.byCategory.length - own === 1 ? "y uses" : "ies use"} the default.
                      </p>
                      <div className="flex gap-2">
                        <Button busy={savingDefault} onClick={() => void saveDefault()}>
                          Change default
                        </Button>
                        <Button variant="secondary" disabled={savingDefault} onClick={() => setPending(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Panel>

          <Panel
            title="By category"
            icon={Layers}
            action={<span className="text-[13px] font-semibold text-navy">{own ? `${own} with their own terms` : "all use the default"}</span>}
          >
            <div className="px-4 pt-3 sm:px-5">
              <div className="relative max-w-xs">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search categories"
                  aria-label="Search categories"
                  className={`${BOX} ${boxBorder()} min-h-9 pl-9 text-[14px]`}
                />
              </div>
            </div>
            {cats.length === 0 ? (
              <p className="px-5 py-6 text-center text-[14px] text-muted">No categories match.</p>
            ) : (
              <motion.ul
                className="grid gap-2.5 px-4 pb-4 pt-3 sm:grid-cols-2 sm:px-5 xl:grid-cols-3"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
              >
                {cats.map((c) => {
                  const choices: { id: PaymentTerms | null; label: string }[] = [
                    { id: null, label: `Default (${settings.platform === "30_70" ? "30/70" : "Full"})` },
                    { id: "30_70", label: "30 / 70" },
                    { id: "full_advance", label: "Full advance" },
                  ]
                  return (
                    <motion.li
                      key={c.categoryId}
                      variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                      className="rounded-lg border border-line/80 px-3 py-2.5"
                      style={c.terms ? { borderColor: "#f09a47", background: "#fffaf5" } : undefined}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold text-navy" title={c.name}>
                          {c.name}
                        </span>
                        {c.terms && <span className="shrink-0 rounded-full bg-orange px-1.5 py-px text-[11px] font-bold text-navy">Own terms</span>}
                      </span>
                      <span className="mt-2 flex rounded-md bg-page p-0.5" role="radiogroup" aria-label={`Payment terms for ${c.name}`}>
                        {choices.map((ch) => {
                          const on = c.terms === ch.id
                          return (
                            <motion.button
                              key={ch.label}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              whileTap={{ scale: 0.95 }}
                              disabled={savingCat === c.categoryId}
                              onClick={() => !on && void saveCategory(c.categoryId, c.name, ch.id)}
                              className={`flex-1 whitespace-nowrap rounded px-1.5 py-1 text-[12px] font-bold transition-colors disabled:opacity-60 ${on ? "btn-gradient text-navy shadow-sm" : "text-muted hover:text-navy"}`}
                            >
                              {ch.label}
                            </motion.button>
                          )
                        })}
                      </span>
                    </motion.li>
                  )
                })}
              </motion.ul>
            )}
          </Panel>
        </div>
      )}
      {toastNode}
    </div>
  )
}
