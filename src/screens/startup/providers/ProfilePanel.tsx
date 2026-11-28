/**
 * One freelancer's anonymous profile, opened from the list in a wide panel
 * so the list stays where it was. Same layout as the freelancer's own
 * "Preview as a startup".
 */

import { useEffect, useState } from "react"
import { getFreelancer } from "../../../services/data/providers"
import { Alert } from "../../../ui/form"
import PublicProfile, { type PublicFreelancer } from "../../freelancer/PublicProfile"
import { errorText } from "../../supplier/parts"
import Panel from "./Panel"
import { ShortlistButton } from "./ShortlistButton"
import { toPublic } from "./shared"

export default function ProfilePanel({
  orgId,
  categoryName,
  saved,
  busy,
  onToggle,
  onClose,
}: {
  orgId: string
  categoryName: (id: string | null) => string | null
  /** Shortlist button; left out where the profile is opened from a proposal. */
  saved?: boolean
  busy?: boolean
  onToggle?: () => void
  onClose: () => void
}) {
  const [profile, setProfile] = useState<PublicFreelancer | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setProfile(undefined)
    getFreelancer(orgId)
      .then((d) => live && setProfile(d ? toPublic(d, categoryName) : null))
      .catch((e) => live && setError(errorText(e)))
    return () => {
      live = false
    }
  }, [orgId, categoryName])

  return (
    <Panel title={profile?.code ?? "Provider profile"} subtitle="As MPI shows it to startups. Names stay private." onClose={onClose} width={1080}>
      {error ? (
        <Alert>{error}</Alert>
      ) : profile === undefined ? (
        <div className="space-y-4" aria-label="Loading profile">
          <div className="h-40 animate-pulse rounded-2xl bg-page" />
          <div className="h-64 animate-pulse rounded-xl bg-page" />
        </div>
      ) : profile === null ? (
        <Alert tone="info">This profile isn't available right now. The freelancer may have paused new work.</Alert>
      ) : (
        <PublicProfile f={profile} actions={onToggle ? <ShortlistButton saved={!!saved} busy={!!busy} onToggle={onToggle} onDark /> : undefined} />
      )}
    </Panel>
  )
}
