/**
 * Startup profile: the person, the company (kept private from suppliers),
 * the startup's stage and what it buys, plus settings. Suppliers only ever
 * see the anonymous name (e.g. "MPI Verified Buyer #2031").
 */

import { useEffect, useMemo, useState } from "react"
import { Building2, CircleDollarSign, Clock3, EyeOff, Gauge, Rocket, ShoppingCart, UserRound, Zap } from "lucide-react"
import { useMe, useSession } from "../../app/session"
import { updateMyOrganisation, updateMyProfile, updateStartupDetails } from "../../services/data/auth"
import { listCategories, type Category } from "../../services/data/catalogue"
import { INDIAN_STATES } from "../startup/new-request/draft"
import { Alert } from "../../ui/form"
import { Badge, ChoiceChips, OptionCards, ProfileSection, SelectInput, Switch, TextArea, TextInput } from "./parts"
import ProfileShell, { HeroChip } from "./ProfileShell"
import SettingsSection from "./SettingsSection"
import { GSTIN_PATTERN, memberSince, numberOrNull, percentFilled, textOrNull, useForm } from "./useForm"

const STAGES = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP" },
  { value: "early_revenue", label: "Early revenue" },
  { value: "traction", label: "Traction" },
  { value: "growth", label: "Growth" },
  { value: "scaling", label: "Scaling" },
]
const FUNDING = [
  { value: "bootstrapped", label: "Bootstrapped" },
  { value: "angel_pre_seed", label: "Angel or pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a_plus", label: "Series A or later" },
]
const TEAM = ["1-10", "11-25", "26-50", "51-200", "200+"].map((v) => ({ value: v, label: `${v} people` }))
const TURNAROUND = [
  { value: "standard" as const, title: "Standard", body: "Usual timelines, best balance of price and speed.", icon: Clock3 },
  { value: "urgent" as const, title: "Fast", body: "Speed matters most. Suppliers who deliver sooner rank higher.", icon: Zap },
  { value: "cost" as const, title: "Lowest cost", body: "Price matters most. You can wait a little longer.", icon: CircleDollarSign },
]
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }))

export default function StartupProfilePage() {
  const me = useMe()
  const { refresh } = useSession()
  const sd = me.startupDetails
  const org = me.organisation

  const initial = useMemo(
    () => ({
      fullName: me.profile.full_name ?? "",
      phone: me.profile.phone ?? "",
      orgName: org.name,
      gstin: org.gstin ?? "",
      city: org.city ?? "",
      state: org.state ?? "",
      stage: sd?.stage ?? "",
      industry: sd?.industry ?? "",
      productsSold: sd?.products_sold ?? "",
      teamSize: sd?.team_size ?? "",
      fundingStage: sd?.funding_stage ?? "",
      hasDpiit: sd?.has_dpiit ?? false,
      dpiitNumber: sd?.dpiit_number ?? "",
      budget: sd?.annual_procurement_budget != null ? String(sd.annual_procurement_budget) : "",
      turnaround: (sd?.turnaround_priority ?? "") as "" | "standard" | "urgent" | "cost",
      interests: sd?.interest_category_ids ?? [],
      description: sd?.procurement_description ?? "",
    }),
    // Only on first load; after saving the form keeps its own copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const form = useForm(initial)
  const v = form.values
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    document.title = "Profile · MPI"
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const validate = () => {
    const found: Record<string, string> = {}
    if (!v.orgName.trim()) found.orgName = "Enter your company's name."
    const gst = v.gstin.trim().toUpperCase()
    if (gst && gst !== form.saved.gstin && !GSTIN_PATTERN.test(gst)) found.gstin = "A GSTIN has 15 letters and numbers, starting with 2 digits."
    if (v.phone.trim() && !/^[+\d][\d\s-]{7,16}$/.test(v.phone.trim())) found.phone = "Enter a phone number, e.g. +91 98450 12890."
    const budget = numberOrNull(v.budget)
    if (v.budget.trim() && (budget == null || budget < 0)) found.budget = "Enter an amount in rupees."
    return found
  }

  const save = async () => {
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      setSaveError("Please fix the highlighted boxes.")
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus())
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const s = form.saved
      const cleaned = { ...v, gstin: v.gstin.trim().toUpperCase(), orgName: v.orgName.trim() }
      if (v.fullName !== s.fullName || v.phone !== s.phone) {
        await updateMyProfile({ full_name: textOrNull(v.fullName), phone: textOrNull(v.phone) })
      }
      if (cleaned.orgName !== s.orgName || cleaned.gstin !== s.gstin || v.city !== s.city || v.state !== s.state) {
        await updateMyOrganisation(org.id, { name: cleaned.orgName, gstin: textOrNull(cleaned.gstin), city: textOrNull(v.city), state: textOrNull(v.state) })
      }
      await updateStartupDetails(org.id, {
        stage: v.stage || null,
        industry: textOrNull(v.industry),
        products_sold: textOrNull(v.productsSold),
        team_size: v.teamSize || null,
        funding_stage: v.fundingStage || null,
        has_dpiit: v.hasDpiit,
        dpiit_number: v.hasDpiit ? textOrNull(v.dpiitNumber) : null,
        annual_procurement_budget: numberOrNull(v.budget),
        turnaround_priority: v.turnaround || null,
        interest_category_ids: v.interests,
        procurement_description: textOrNull(v.description),
      })
      form.markSaved(cleaned)
      void refresh()
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const percent = percentFilled([
    v.fullName,
    v.phone,
    v.orgName,
    v.gstin,
    v.city,
    v.state,
    v.stage,
    v.industry,
    v.productsSold,
    v.teamSize,
    v.fundingStage,
    v.budget,
    v.turnaround,
    v.interests,
    v.description,
  ])
  const left = Math.round(((100 - percent) / 100) * 15)

  return (
    <ProfileShell
      name={v.orgName || "Your company"}
      subtitle={[v.fullName || me.email, memberSince(org.created_at) && `Member since ${memberSince(org.created_at)}`].filter(Boolean).join(" · ")}
      chips={
        <>
          <HeroChip tone="orange">Startup</HeroChip>
          {v.hasDpiit && <HeroChip>DPIIT recognised</HeroChip>}
          {v.city && <HeroChip>{[v.city, v.state].filter(Boolean).join(", ")}</HeroChip>}
        </>
      }
      alias={{ label: "Suppliers see you as", value: org.display_name }}
      completeness={{
        percent,
        hint:
          percent === 100
            ? "Your profile is complete. Matches use all of it."
            : `${left} more ${left === 1 ? "detail helps" : "details help"} MPI match you better.`,
      }}
      dirty={form.dirty}
      saving={saving}
      saveError={saveError}
      onSave={() => void save()}
      onDiscard={() => {
        form.discard()
        setErrors({})
        setSaveError(null)
      }}
      cells={[
        <>
          <ProfileSection id="you" icon={UserRound} title="Your details" description="How MPI reaches you about requests and orders.">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput label="Full name" value={v.fullName} onChange={(x) => form.set("fullName", x)} autoComplete="name" maxLength={120} />
              <TextInput label="Email" value={me.email} onChange={() => {}} readOnly hint="Your login. It can't be changed here." />
              <TextInput
                label="Mobile number"
                type="tel"
                value={v.phone}
                onChange={(x) => form.set("phone", x)}
                error={errors.phone}
                autoComplete="tel"
                placeholder="+91 98450 12890"
                maxLength={20}
              />
            </div>
          </ProfileSection>
        </>,
        <>
          <ProfileSection
            id="company"
            icon={Building2}
            title="Company"
            description="Your registered business details."
            badge={<Badge icon={EyeOff}>Hidden from suppliers</Badge>}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <TextInput label="Registered company name" value={v.orgName} onChange={(x) => form.set("orgName", x)} error={errors.orgName} maxLength={160} />
              <TextInput
                label="GSTIN"
                aside="Optional"
                value={v.gstin}
                onChange={(x) => form.set("gstin", x.toUpperCase())}
                error={errors.gstin}
                maxLength={15}
                placeholder="29ABCDE1234F1Z5"
                className="uppercase tracking-wide"
              />
              <TextInput label="City" value={v.city} onChange={(x) => form.set("city", x)} autoComplete="address-level2" maxLength={80} />
              <SelectInput label="State" value={v.state} onChange={(x) => form.set("state", x)} options={STATE_OPTIONS} placeholder="Choose a state" />
            </div>
          </ProfileSection>
        </>,
        <>
          <ProfileSection id="startup" icon={Rocket} title="Startup profile" description="Helps MPI pick suppliers that suit a company of your size.">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectInput label="Stage" value={v.stage} onChange={(x) => form.set("stage", x)} options={STAGES} />
              <SelectInput label="Team size" value={v.teamSize} onChange={(x) => form.set("teamSize", x)} options={TEAM} />
              <SelectInput label="Funding" value={v.fundingStage} onChange={(x) => form.set("fundingStage", x)} options={FUNDING} />
              <TextInput label="Industry" value={v.industry} onChange={(x) => form.set("industry", x)} placeholder="e.g. D2C food" maxLength={120} />
            </div>
            <div className="mt-5">
              <TextInput
                label="What you sell"
                value={v.productsSold}
                onChange={(x) => form.set("productsSold", x)}
                placeholder="e.g. Ready-to-eat snacks and spice mixes"
                hint="Helps suppliers suggest the right materials, e.g. food-safe packaging."
                maxLength={300}
              />
            </div>
            <div className="mt-5 grid gap-4 rounded-xl bg-navy-tint/60 p-4 sm:grid-cols-2 sm:items-start">
              <Switch
                label="Recognised by DPIIT (Startup India)"
                description="Some government schemes need this."
                checked={v.hasDpiit}
                onChange={(x) => form.set("hasDpiit", x)}
              />
              {v.hasDpiit && (
                <TextInput label="DPIIT number" value={v.dpiitNumber} onChange={(x) => form.set("dpiitNumber", x)} placeholder="DIPP12345" maxLength={30} />
              )}
            </div>
          </ProfileSection>
        </>,
        <>
          <ProfileSection
            id="buying"
            icon={ShoppingCart}
            title="What you buy"
            description="MPI uses this to suggest suppliers and to fill new requests faster."
            badge={
              <Badge icon={Gauge} tone="orange">
                Used for matching
              </Badge>
            }
          >
            <div className="space-y-7">
              <ChoiceChips
                label="Groups you buy from"
                hint="Tap all that apply."
                options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
                selected={v.interests}
                onChange={(x) => form.set("interests", x)}
              />
              <OptionCards label="What matters most" options={TURNAROUND} value={v.turnaround} onChange={(x) => form.set("turnaround", x)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <TextInput
                    label="Yearly buying budget (₹)"
                    aside="Optional"
                    inputMode="numeric"
                    value={v.budget}
                    onChange={(x) => form.set("budget", x.replace(/[^\d,]/g, ""))}
                    error={errors.budget}
                    placeholder="25,00,000"
                  />
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                    <EyeOff size={14} aria-hidden="true" />
                    Only you and MPI see this.
                  </p>
                </div>
                <TextArea
                  label="Anything else suppliers should know"
                  value={v.description}
                  onChange={(x) => form.set("description", x)}
                  rows={4}
                  placeholder="e.g. We need food-safe packaging for 3 warehouses, about 20,000 boxes a month."
                />
              </div>
              {categories === null && <Alert tone="info">Loading the catalogue groups…</Alert>}
            </div>
          </ProfileSection>
        </>,
      ]}
      settings={<SettingsSection email={me.email} />}
    />
  )
}
