/**
 * About: introduction, how the freelancer works, and private details, in three
 * small tabs inside one panel so it never becomes a long form. One Save for all.
 */

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CircleCheck, Lock, RotateCcw, Save, UserRound, X } from "lucide-react"
import { useMe, useSession } from "../../../app/session"
import { updateMyOrganisation, updateVendorDetails } from "../../../services/data/auth"
import { setMyCategories, updateMyProviderProfile, type Language, type LanguageLevel } from "../../../services/data/providers"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder } from "../../../ui/form"
import { ChoiceChips, SelectInput, TagsInput, TextArea, TextInput } from "../../profile/parts"
import { numberOrNull, PAN_PATTERN, textOrNull } from "../../profile/useForm"
import { INDIAN_STATES } from "../../startup/new-request/draft"
import { errorText } from "../../supplier/parts"
import { Group, PrivateBox, SectionPanel, Segmented, Stepper } from "../ui"
import { AVAILABILITY, LANGUAGE_LEVELS, WORK_MODES } from "../useBuilder"
import type { SectionProps } from "./types"

type Sub = "intro" | "work" | "private"
const SUBS: { id: Sub; label: string }[] = [
  { id: "intro", label: "Introduction" },
  { id: "work", label: "How you work" },
  { id: "private", label: "Private details" },
]
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }))
const TOOL_SUGGESTIONS = ["Figma", "Canva", "Adobe Illustrator", "Photoshop", "Shopify", "WordPress", "Webflow", "Google Analytics"]

export default function About({ b, orgId, reload, toast }: SectionProps) {
  const me = useMe()
  const { refresh } = useSession()
  const p = b.data.profile
  const initial = useMemo(
    () => ({
      headline: p.headline ?? "",
      bio: p.bio ?? "",
      years: p.years_experience?.toString() ?? "",
      categories: b.data.categoryIds,
      languages: (Array.isArray(p.languages) ? p.languages : []) as unknown as Language[],
      tools: p.tools,
      workMode: p.work_mode,
      city: me.organisation.city ?? "",
      state: me.organisation.state ?? "",
      area: p.service_area ?? "",
      availability: p.availability,
      parallel: p.max_parallel_projects,
      delivery: p.usual_delivery_days?.toString() ?? "",
      legalName: p.legal_name ?? "",
      pan: me.vendorDetails?.pan_number ?? "",
      payout: p.payout_reference ?? "",
    }),
    [p, b.data.categoryIds, me.organisation.city, me.organisation.state, me.vendorDetails?.pan_number],
  )
  const [v, setV] = useState(initial)
  const [sub, setSub] = useState<Sub>("intro")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState<{ name: string; level: LanguageLevel }>({ name: "", level: "fluent" })
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }))
  const dirty = JSON.stringify(v) !== JSON.stringify(initial)

  const panError = v.pan && !PAN_PATTERN.test(v.pan.toUpperCase()) ? "A PAN looks like ABCDE1234F." : null
  const yearsError = v.years && (Number(v.years) < 0 || Number(v.years) > 60) ? "Between 0 and 60." : null
  const deliveryError = v.delivery && (Number(v.delivery) < 1 || Number(v.delivery) > 365) ? "Between 1 and 365 days." : null

  const save = async () => {
    if (panError || yearsError || deliveryError) {
      setError("Please fix the highlighted fields first.")
      setSub(panError ? "private" : yearsError ? "intro" : "work")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateMyProviderProfile(orgId, {
        headline: textOrNull(v.headline),
        bio: textOrNull(v.bio),
        years_experience: numberOrNull(v.years),
        languages: v.languages,
        tools: v.tools,
        work_mode: v.workMode,
        service_area: textOrNull(v.area),
        availability: v.availability,
        max_parallel_projects: v.parallel,
        usual_delivery_days: numberOrNull(v.delivery),
        legal_name: textOrNull(v.legalName),
        payout_reference: textOrNull(v.payout),
      })
      await setMyCategories(orgId, v.categories)
      await updateMyOrganisation(orgId, { city: textOrNull(v.city), state: textOrNull(v.state) })
      await updateVendorDetails(orgId, { pan_number: textOrNull(v.pan.toUpperCase()) })
      await Promise.all([reload(), refresh()])
      toast("About saved")
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionPanel
      icon={UserRound}
      title="About"
      subtitle="Who you are and how you work. Startups see this without your name."
      aside={
        <div role="tablist" aria-label="About" className="inline-flex rounded-lg border-[1.5px] border-line bg-white p-1">
          {SUBS.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={sub === s.id} onClick={() => setSub(s.id)} className={`relative flex min-h-9 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-semibold ${sub === s.id ? "text-white" : "text-navy hover:bg-navy-tint"}`}>
              {sub === s.id && <motion.span layoutId="about-sub" className="absolute inset-0 rounded-md bg-navy" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative inline-flex items-center gap-1.5">
                {s.id === "private" && <Lock size={13} aria-hidden="true" />}
                {s.label}
              </span>
            </button>
          ))}
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div key={sub} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
          {sub === "intro" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <TextInput label="Headline" value={v.headline} onChange={(x) => set("headline", x)} maxLength={120} aside={`${v.headline.length}/120`} placeholder="e.g. UI/UX designer and Shopify developer for D2C brands" hint="One line that says what you do best." />
                <TextInput label="Years of experience" type="number" inputMode="numeric" min={0} max={60} value={v.years} onChange={(x) => set("years", x)} error={yearsError} className="max-w-40" />
                <ChoiceChips label="Categories you work in" hint="Only categories MPI has opened to freelancers." options={b.categories.map((c) => ({ value: c.id, label: c.name }))} selected={v.categories} onChange={(x) => set("categories", x)} />
              </div>
              <TextArea label="Short bio" value={v.bio} onChange={(x) => set("bio", x)} rows={9} maxLength={2000} aside={`${v.bio.trim().length}/2000`} placeholder="What kind of work you do, for whom, and how you work. At least 50 characters." hint={v.bio.trim().length < 50 ? `${50 - v.bio.trim().length} more characters needed to send for review.` : "Don't add your name, phone or links. MPI shares contact details after an order."} />
            </div>
          )}

          {sub === "work" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <Group label="Work mode">
                  <Segmented label="Work mode" options={[...WORK_MODES]} value={v.workMode as (typeof WORK_MODES)[number]["value"]} onChange={(x) => set("workMode", x)} />
                </Group>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput label="City" value={v.city} onChange={(x) => set("city", x)} autoComplete="address-level2" />
                  <SelectInput label="State" value={v.state} onChange={(x) => set("state", x)} options={STATE_OPTIONS} />
                </div>
                <TextInput label="Where you take work" value={v.area} onChange={(x) => set("area", x)} maxLength={200} placeholder="e.g. Anywhere in India, or Pune and Mumbai on-site" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Group label="Projects at a time">
                    <Stepper label="projects at a time" value={v.parallel} min={1} max={20} onChange={(x) => set("parallel", x)} />
                  </Group>
                  <TextInput label="Usual delivery (days)" type="number" inputMode="numeric" min={1} max={365} value={v.delivery} onChange={(x) => set("delivery", x)} error={deliveryError} />
                </div>
                <Group label="Availability">
                  <Segmented label="Availability" options={[...AVAILABILITY]} value={v.availability as (typeof AVAILABILITY)[number]["value"]} onChange={(x) => set("availability", x)} />
                </Group>
              </div>
              <div className="space-y-5">
                <Group label="Languages">
                  <div className="flex flex-wrap gap-2">
                    {v.languages.map((l) => (
                      <span key={l.name} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-navy px-3 text-sm font-semibold text-white">
                        {l.name} <span className="font-normal capitalize text-white/70">· {l.level}</span>
                        <button type="button" onClick={() => set("languages", v.languages.filter((x) => x.name !== l.name))} className="-mr-1 rounded-full p-1 text-white/70 hover:bg-white/15" aria-label={`Remove ${l.name}`}>
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex max-w-md gap-2">
                    <input value={lang.name} onChange={(e) => setLang((s) => ({ ...s, name: e.target.value }))} placeholder="Language" maxLength={30} aria-label="Language" className={`${BOX} ${boxBorder()} h-11`} />
                    <select value={lang.level} onChange={(e) => setLang((s) => ({ ...s, level: e.target.value as LanguageLevel }))} aria-label="Level" className={`${BOX} ${boxBorder()} h-11 w-44`}>
                      {LANGUAGE_LEVELS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!lang.name.trim() || v.languages.some((l) => l.name.toLowerCase() === lang.name.trim().toLowerCase())}
                      onClick={() => {
                        set("languages", [...v.languages, { name: lang.name.trim(), level: lang.level }])
                        setLang({ name: "", level: "fluent" })
                      }}
                      className="min-h-11 shrink-0 rounded-md border-[1.5px] border-navy px-4 text-[15px] font-bold text-navy hover:bg-navy-tint disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </Group>
                <TagsInput label="Tools you use" values={v.tools} onChange={(x) => set("tools", x)} placeholder="Add a tool" suggestions={TOOL_SUGGESTIONS} max={20} />
              </div>
            </div>
          )}

          {sub === "private" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <PrivateBox note="Used by MPI to check who you are and to pay you. Never shown to startups.">
                <TextInput label="Legal name" value={v.legalName} onChange={(x) => set("legalName", x)} autoComplete="name" hint="As on your PAN card." />
                <TextInput label="PAN" value={v.pan} onChange={(x) => set("pan", x.toUpperCase())} maxLength={10} error={panError} placeholder="ABCDE1234F" className="uppercase" />
                <TextInput label="Payout reference" value={v.payout} onChange={(x) => set("payout", x)} maxLength={200} hint="A reference MPI gives you for your payouts. Don't type full bank details here." />
              </PrivateBox>
              <div className="space-y-3 text-[14px] text-navy">
                <p className="flex gap-2.5 rounded-xl bg-white p-4">
                  <CircleCheck size={18} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" />
                  Startups see you only as <b className="mx-1">{me.organisation.display_name}</b>.
                </p>
                <p className="flex gap-2.5 rounded-xl bg-white p-4">
                  <CircleCheck size={18} className="mt-0.5 shrink-0 text-[#047857]" aria-hidden="true" />
                  To get the "Identity (PAN) checked" and "Bank checked" ticks, add them under Checks. MPI looks at them by hand.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {(dirty || error) && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-orange/60 bg-white px-4 py-3">
          <p className="flex-1 text-[14.5px] font-semibold">{error ? <span className="text-red-text">{error}</span> : <span className="text-navy">You have unsaved changes.</span>}</p>
          {dirty && (
            <>
              <Button variant="ghost" onClick={() => { setV(initial); setError(null) }} disabled={busy}>
                <RotateCcw size={16} aria-hidden="true" /> Discard
              </Button>
              <Button onClick={() => void save()} busy={busy}>
                <Save size={16} aria-hidden="true" /> {busy ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      )}
      {error && !dirty && <div className="mt-3"><Alert>{error}</Alert></div>}
    </SectionPanel>
  )
}
