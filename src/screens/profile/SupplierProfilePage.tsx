/**
 * Supplier (MSME) profile: verification status, the person, the business and
 * its registration numbers (private), what it supplies, capacity, quality,
 * plus settings. Startups only see the anonymous name until an order.
 */

import { useEffect, useMemo, useState } from "react"
import {
  BadgeCheck,
  Building2,
  CircleAlert,
  Factory,
  EyeOff,
  Hourglass,
  Layers,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useMe, useSession } from "../../app/session"
import {
  listVendorCategories,
  setVendorCategories,
  updateMyOrganisation,
  updateMyProfile,
  updateVendorDetails,
} from "../../services/data/auth"
import { listCategories, type Category } from "../../services/data/catalogue"
import { COMMON_CERTIFICATIONS, INDIAN_STATES } from "../startup/new-request/draft"
import { Badge, ChoiceChips, ProfileSection, SelectInput, Switch, TagsInput, TextArea, TextInput } from "./parts"
import ProfileShell, { HeroChip } from "./ProfileShell"
import SettingsSection from "./SettingsSection"
import { GSTIN_PATTERN, memberSince, numberOrNull, PAN_PATTERN, percentFilled, textOrNull, UDYAM_PATTERN, useForm } from "./useForm"

const ENTERPRISE = [
  { value: "micro", label: "Micro" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
]
const TURNOVER = [
  { value: "under_1_cr", label: "Under ₹1 crore" },
  { value: "1_to_5_cr", label: "₹1 to 5 crore" },
  { value: "5_to_25_cr", label: "₹5 to 25 crore" },
  { value: "25_to_50_cr", label: "₹25 to 50 crore" },
  { value: "50_to_250_cr", label: "₹50 to 250 crore" },
]
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }))

const SECTIONS = [
  { id: "status", label: "Verification" },
  { id: "you", label: "Your details" },
  { id: "business", label: "Business" },
  { id: "supply", label: "What you supply" },
  { id: "capacity", label: "Capacity" },
  { id: "quality", label: "Quality" },
  { id: "settings", label: "Settings" },
]

type Status = ReturnType<typeof useMe>["organisation"]["verification_status"]

const STATUS: Record<Status, { chip: string; tone: "plain" | "orange" | "warn"; title: string; body: string }> = {
  verified: { chip: "Verified", tone: "orange", title: "You're a verified supplier", body: "MPI checked your registration. You can receive requests from startups." },
  pending: {
    chip: "Waiting for verification",
    tone: "plain",
    title: "Get verified to start receiving requests",
    body: "Add your Udyam and GST numbers below and save. The MPI team then checks them and you get a notification.",
  },
  under_review: { chip: "Being checked", tone: "plain", title: "MPI is checking your details", body: "You'll get a notification when it's done. You can still update your profile." },
  needs_info: { chip: "Needs more details", tone: "warn", title: "MPI needs a little more from you", body: "Please update the details below and save." },
  rejected: { chip: "Not approved", tone: "warn", title: "Your verification wasn't approved", body: "Please contact the MPI team." },
  suspended: { chip: "Paused", tone: "warn", title: "Your account is paused", body: "You won't receive new requests for now. Please contact the MPI team." },
  not_required: { chip: "Supplier", tone: "plain", title: "Supplier account", body: "" },
}

export default function SupplierProfilePage() {
  const me = useMe()
  const { refresh } = useSession()
  const org = me.organisation
  const vd = me.vendorDetails
  const verified = org.verification_status === "verified"

  const initial = useMemo(
    () => ({
      fullName: me.profile.full_name ?? "",
      phone: me.profile.phone ?? "",
      orgName: org.name,
      udyam: org.udyam_number ?? "",
      gstin: org.gstin ?? "",
      pan: vd?.pan_number ?? "",
      city: org.city ?? "",
      state: org.state ?? "",
      factoryAddress: vd?.factory_address ?? "",
      categories: [] as string[],
      enterpriseType: vd?.enterprise_type ?? "",
      turnover: vd?.turnover_band ?? "",
      monthlyCapacity: vd?.monthly_capacity ?? "",
      utilisation: vd?.capacity_utilisation_pct != null ? String(vd.capacity_utilisation_pct) : "",
      moq: vd?.moq != null ? String(vd.moq) : "",
      leadTime: vd?.lead_time_days != null ? String(vd.lead_time_days) : "",
      panIndia: vd?.pan_india_dispatch ?? false,
      certifications: vd?.certifications ?? [],
      machinery: vd?.machinery ?? [],
      testing: vd?.quality_testing_facilities ?? [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const form = useForm(initial)
  const v = form.values
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    document.title = "Profile · MPI"
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
    listVendorCategories(org.id)
      .then((ids) => form.reset({ ...form.saved, categories: ids }))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const validate = () => {
    const s = form.saved
    const found: Record<string, string> = {}
    if (!v.orgName.trim()) found.orgName = "Enter your business name."
    const udyam = v.udyam.trim().toUpperCase()
    if (udyam && udyam !== s.udyam && !UDYAM_PATTERN.test(udyam)) found.udyam = "Use the format UDYAM-MH-12-1234567."
    const gst = v.gstin.trim().toUpperCase()
    if (gst && gst !== s.gstin && !GSTIN_PATTERN.test(gst)) found.gstin = "A GSTIN has 15 letters and numbers, starting with 2 digits."
    const pan = v.pan.trim().toUpperCase()
    if (pan && !PAN_PATTERN.test(pan)) found.pan = "A PAN looks like ABCDE1234F."
    if (v.phone.trim() && !/^[+\d][\d\s-]{7,16}$/.test(v.phone.trim())) found.phone = "Enter a phone number, e.g. +91 98450 12890."
    const util = numberOrNull(v.utilisation)
    if (v.utilisation.trim() && (util == null || util < 0 || util > 100)) found.utilisation = "Enter a number from 0 to 100."
    if (v.moq.trim() && (numberOrNull(v.moq) ?? -1) < 0) found.moq = "Enter a number."
    if (v.leadTime.trim() && (numberOrNull(v.leadTime) ?? -1) < 0) found.leadTime = "Enter a number of days."
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
      const cleaned = {
        ...v,
        orgName: v.orgName.trim(),
        udyam: v.udyam.trim().toUpperCase(),
        gstin: v.gstin.trim().toUpperCase(),
        pan: v.pan.trim().toUpperCase(),
      }
      if (v.fullName !== s.fullName || v.phone !== s.phone) {
        await updateMyProfile({ full_name: textOrNull(v.fullName), phone: textOrNull(v.phone) })
      }
      if (cleaned.orgName !== s.orgName || cleaned.udyam !== s.udyam || cleaned.gstin !== s.gstin || v.city !== s.city || v.state !== s.state) {
        await updateMyOrganisation(org.id, {
          name: cleaned.orgName,
          udyam_number: textOrNull(cleaned.udyam),
          gstin: textOrNull(cleaned.gstin),
          city: textOrNull(v.city),
          state: textOrNull(v.state),
        })
      }
      await updateVendorDetails(org.id, {
        pan_number: textOrNull(cleaned.pan),
        factory_address: textOrNull(v.factoryAddress),
        enterprise_type: (v.enterpriseType || null) as "micro" | "small" | "medium" | null,
        turnover_band: v.turnover || null,
        monthly_capacity: textOrNull(v.monthlyCapacity),
        capacity_utilisation_pct: numberOrNull(v.utilisation),
        moq: numberOrNull(v.moq),
        lead_time_days: numberOrNull(v.leadTime),
        pan_india_dispatch: v.panIndia,
        certifications: v.certifications,
        machinery: v.machinery,
        quality_testing_facilities: v.testing,
      })
      if (JSON.stringify([...v.categories].sort()) !== JSON.stringify([...s.categories].sort())) {
        await setVendorCategories(org.id, v.categories)
      }
      form.markSaved(cleaned)
      void refresh()
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const status = STATUS[org.verification_status]
  const percent = percentFilled([
    v.fullName, v.phone, v.orgName, v.udyam, v.gstin, v.pan, v.city, v.state, v.factoryAddress, v.categories,
    v.enterpriseType, v.turnover, v.monthlyCapacity, v.moq, v.leadTime, v.certifications, v.machinery,
  ])
  const left = Math.round(((100 - percent) / 100) * 17)
  const StatusIcon = verified ? BadgeCheck : status.tone === "warn" ? CircleAlert : Hourglass

  return (
    <ProfileShell
      name={v.orgName || "Your business"}
      subtitle={[v.fullName || me.email, memberSince(org.created_at) && `Member since ${memberSince(org.created_at)}`].filter(Boolean).join(" · ")}
      chips={
        <>
          <HeroChip tone={status.tone}>
            {verified && <BadgeCheck size={13} aria-hidden="true" />}
            {status.chip}
          </HeroChip>
          {v.enterpriseType && <HeroChip>{ENTERPRISE.find((e) => e.value === v.enterpriseType)?.label} enterprise</HeroChip>}
          {v.city && <HeroChip>{[v.city, v.state].filter(Boolean).join(", ")}</HeroChip>}
        </>
      }
      alias={{ label: "Startups see you as", value: org.display_name }}
      completeness={{
        percent,
        hint: percent === 100 ? "Your profile is complete. Matches use all of it." : `${left} more ${left === 1 ? "detail helps" : "details help"} you get matched more often.`,
      }}
      sections={SECTIONS}
      dirty={form.dirty}
      saving={saving}
      saveError={saveError}
      onSave={() => void save()}
      onDiscard={() => {
        form.discard()
        setErrors({})
        setSaveError(null)
      }}
    >
      <section
        id="status"
        className={`scroll-mt-24 flex items-start gap-4 rounded-xl border-[1.5px] p-5 sm:p-6 ${
          verified ? "border-orange/60 bg-orange-tint/60" : status.tone === "warn" ? "border-red/40 bg-red-tint" : "border-navy/20 bg-white"
        }`}
      >
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${verified ? "bg-navy text-orange" : "bg-navy-tint text-navy"}`}>
          <StatusIcon size={22} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-navy">{status.title}</h2>
          <p className="mt-0.5 text-[15px] text-navy/80">{status.body}</p>
          {org.verification_note && !verified && (
            <p className="mt-2 rounded-md bg-white/80 p-3 text-[15px] text-navy">
              <strong className="font-semibold">Note from MPI:</strong> {org.verification_note}
            </p>
          )}
          {verified && org.verified_at && (
            <p className="mt-1 text-sm text-muted">Verified on {new Date(org.verified_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          )}
        </div>
      </section>

      <ProfileSection id="you" icon={UserRound} title="Your details" description="How MPI reaches you about requests and orders.">
        <div className="grid gap-5 md:grid-cols-3">
          <TextInput label="Full name" value={v.fullName} onChange={(x) => form.set("fullName", x)} autoComplete="name" maxLength={120} />
          <TextInput label="Email" value={me.email} onChange={() => {}} readOnly hint="Your login. It can't be changed here." />
          <TextInput label="Mobile number" type="tel" value={v.phone} onChange={(x) => form.set("phone", x)} error={errors.phone} autoComplete="tel" placeholder="+91 98450 12890" maxLength={20} />
        </div>
      </ProfileSection>

      <ProfileSection
        id="business"
        icon={Building2}
        title="Business and registration"
        description="MPI uses these to verify you."
        badge={<Badge icon={EyeOff}>Hidden from startups</Badge>}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Registered business name" value={v.orgName} onChange={(x) => form.set("orgName", x)} error={errors.orgName} maxLength={160} />
          <TextInput
            label="Udyam number"
            value={v.udyam}
            onChange={(x) => form.set("udyam", x.toUpperCase())}
            error={errors.udyam}
            readOnly={verified}
            hint={verified ? "Checked by MPI. Ask the MPI team to change it." : "From your Udyam registration certificate."}
            placeholder="UDYAM-MH-12-1234567"
            maxLength={19}
            className="uppercase tracking-wide"
          />
          <TextInput
            label="GSTIN"
            value={v.gstin}
            onChange={(x) => form.set("gstin", x.toUpperCase())}
            error={errors.gstin}
            readOnly={verified}
            hint={verified ? "Checked by MPI. Ask the MPI team to change it." : undefined}
            placeholder="27ABCDE1234F1Z5"
            maxLength={15}
            className="uppercase tracking-wide"
          />
          <TextInput label="PAN" aside="Optional" value={v.pan} onChange={(x) => form.set("pan", x.toUpperCase())} error={errors.pan} placeholder="ABCDE1234F" maxLength={10} className="uppercase tracking-wide" />
          <TextInput label="City" value={v.city} onChange={(x) => form.set("city", x)} autoComplete="address-level2" maxLength={80} />
          <SelectInput label="State" value={v.state} onChange={(x) => form.set("state", x)} options={STATE_OPTIONS} placeholder="Choose a state" />
        </div>
        <div className="mt-5">
          <TextArea label="Factory or work address" value={v.factoryAddress} onChange={(x) => form.set("factoryAddress", x)} rows={2} maxLength={400} />
        </div>
      </ProfileSection>

      <ProfileSection
        id="supply"
        icon={Layers}
        title="What you supply"
        description="You only get requests in the groups you choose."
        badge={<Badge tone="orange">Used for matching</Badge>}
      >
        <ChoiceChips
          label="Groups you supply"
          hint="Tap all that apply."
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          selected={v.categories}
          onChange={(x) => form.set("categories", x)}
        />
      </ProfileSection>

      <ProfileSection id="capacity" icon={Factory} title="Capacity" description="Helps MPI send you requests you can actually take on.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <SelectInput label="Enterprise size" value={v.enterpriseType} onChange={(x) => form.set("enterpriseType", x)} options={ENTERPRISE} hint="As on your Udyam certificate." />
          <SelectInput label="Yearly turnover" value={v.turnover} onChange={(x) => form.set("turnover", x)} options={TURNOVER} />
          <TextInput label="Monthly capacity" value={v.monthlyCapacity} onChange={(x) => form.set("monthlyCapacity", x)} placeholder="e.g. 50,000 boxes" maxLength={120} />
          <TextInput label="Capacity in use (%)" inputMode="numeric" value={v.utilisation} onChange={(x) => form.set("utilisation", x.replace(/[^\d]/g, ""))} error={errors.utilisation} placeholder="60" maxLength={3} hint="How busy you are right now." />
          <TextInput label="Minimum order quantity" inputMode="numeric" value={v.moq} onChange={(x) => form.set("moq", x.replace(/[^\d.]/g, ""))} error={errors.moq} placeholder="500" maxLength={12} />
          <TextInput label="Usual lead time (days)" inputMode="numeric" value={v.leadTime} onChange={(x) => form.set("leadTime", x.replace(/[^\d]/g, ""))} error={errors.leadTime} placeholder="10" maxLength={4} />
        </div>
        <div className="mt-5 max-w-xl">
          <Switch label="I deliver anywhere in India" description="Helps you match requests from other states too." checked={v.panIndia} onChange={(x) => form.set("panIndia", x)} />
        </div>
      </ProfileSection>

      <ProfileSection id="quality" icon={ShieldCheck} title="Quality" description="Startups can ask for certifications. Ones you hold rank you higher.">
        <div className="space-y-7">
          <TagsInput
            label="Certifications you hold"
            values={v.certifications}
            onChange={(x) => form.set("certifications", x)}
            suggestions={COMMON_CERTIFICATIONS}
            placeholder="Another one, e.g. GMP"
          />
          <TagsInput label="Main machines" values={v.machinery} onChange={(x) => form.set("machinery", x)} placeholder="e.g. 5-ply corrugation line" />
          <TagsInput label="Testing you can do" values={v.testing} onChange={(x) => form.set("testing", x)} placeholder="e.g. Burst strength test" />
        </div>
      </ProfileSection>

      <SettingsSection email={me.email} />
    </ProfileShell>
  )
}
