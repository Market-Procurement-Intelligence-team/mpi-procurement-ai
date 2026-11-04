/**
 * Admin Settings tab: the usual settings (appearance, password, sign out),
 * then Demo workspace to reload the investor demo with fresh sample data.
 * It is kept here, not in the top menu, so it isn't clicked by accident.
 */

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { AlertTriangle, CheckCircle2, Clock, RefreshCcw, ShieldCheck } from "lucide-react"
import { resetDemoWorkspace } from "../../services/data/admin"
import Button from "../../ui/Button"
import { Alert } from "../../ui/form"
import { ProfileSection } from "./parts"
import SettingsSection from "./SettingsSection"

export default function AdminSettings({ email }: { email: string }) {
  return (
    <div className="space-y-6">
      <SettingsSection email={email} />
      <DemoWorkspace />
    </div>
  )
}

function DemoWorkspace() {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string; at?: Date } | null>(null)

  const reset = async () => {
    setBusy(true)
    setResult(null)
    try {
      const text = await resetDemoWorkspace()
      setResult({ ok: true, text, at: new Date() })
      setConfirming(false)
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error && err.message ? err.message : "Couldn't reset the demo. Please try again." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfileSection
      id="demo"
      icon={RefreshCcw}
      title="Demo workspace"
      description="Puts the demo accounts back to a fresh, ready-to-show state."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-base font-bold text-navy">What a reset does</h3>
          <ul className="mt-2 space-y-2 text-[14.5px] text-navy">
            <li className="flex gap-2.5">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" />
              Reloads the demo startup's requests, AI matches, supplier quotes and price offers.
            </li>
            <li className="flex gap-2.5">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" />
              Adds sample orders with their invoices and simulated payments, plus sample rate cards.
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" />
              Only touches the demo accounts. Real startups, suppliers and their data stay as they are.
            </li>
          </ul>
          <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-navy-tint/60 px-3.5 py-3 text-[14px] text-navy">
            <Clock size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Price offers expire after 24 hours, so <b>reset on the morning of a demo</b>, and before testing the full flow.
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <h3 className="text-base font-bold text-navy">Reset the demo</h3>
          <p className="text-sm text-muted">Anything done in the demo accounts since the last reset is replaced.</p>
          <AnimatePresence mode="wait" initial={false}>
            {confirming ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="w-full rounded-xl border-[1.5px] border-orange bg-orange-tint/50 p-4"
              >
                <p className="flex items-start gap-2 text-[14.5px] font-semibold text-navy">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-text" aria-hidden="true" />
                  Replace all demo requests, offers and orders now?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button busy={busy} onClick={() => void reset()}>
                    {busy ? "Resetting…" : "Yes, reset the demo"}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="start" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <Button onClick={() => setConfirming(true)}>
                  <RefreshCcw size={17} aria-hidden="true" />
                  Reset demo workspace
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          {result && (
            <div className="w-full">
              {result.ok ? (
                <Alert tone="info">
                  Demo reset at {result.at?.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. {result.text}
                </Alert>
              ) : (
                <Alert>{result.text}</Alert>
              )}
            </div>
          )}
        </div>
      </div>
    </ProfileSection>
  )
}
