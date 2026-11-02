/** Admin profile: the person's own details and settings. */

import { useEffect, useMemo, useState } from "react"
import { UserRound } from "lucide-react"
import { useMe, useSession } from "../../app/session"
import { updateMyProfile } from "../../services/data/auth"
import { ProfileSection, TextInput } from "./parts"
import ProfileShell, { HeroChip } from "./ProfileShell"
import SettingsSection from "./SettingsSection"
import { textOrNull, useForm } from "./useForm"

export default function AdminProfilePage() {
  const me = useMe()
  const { refresh } = useSession()
  const initial = useMemo(() => ({ fullName: me.profile.full_name ?? "", phone: me.profile.phone ?? "" }), [])
  const form = useForm(initial)
  const v = form.values
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Profile · MPI"
  }, [])

  const save = async () => {
    const bad = v.phone.trim() && !/^[+\d][\d\s-]{7,16}$/.test(v.phone.trim())
    setPhoneError(bad ? "Enter a phone number, e.g. +91 98450 12890." : null)
    if (bad) return setSaveError("Please fix the highlighted box.")
    setSaving(true)
    setSaveError(null)
    try {
      await updateMyProfile({ full_name: textOrNull(v.fullName), phone: textOrNull(v.phone) })
      form.markSaved()
      void refresh()
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProfileShell
      name={v.fullName || me.email}
      subtitle={me.email}
      chips={<HeroChip tone="orange">MPI admin</HeroChip>}
      dirty={form.dirty}
      saving={saving}
      saveError={saveError}
      onSave={() => void save()}
      onDiscard={() => {
        form.discard()
        setPhoneError(null)
        setSaveError(null)
      }}
      cells={[
        <>
          <ProfileSection id="you" icon={UserRound} title="Your details">
            <div className="grid gap-5 md:grid-cols-3">
              <TextInput label="Full name" value={v.fullName} onChange={(x) => form.set("fullName", x)} autoComplete="name" maxLength={120} />
              <TextInput label="Email" value={me.email} onChange={() => {}} readOnly hint="Your login. It can't be changed here." />
              <TextInput
                label="Mobile number"
                type="tel"
                value={v.phone}
                onChange={(x) => form.set("phone", x)}
                error={phoneError}
                autoComplete="tel"
                maxLength={20}
              />
            </div>
          </ProfileSection>
        </>,
      ]}
      settings={<SettingsSection email={me.email} />}
    />
  )
}
