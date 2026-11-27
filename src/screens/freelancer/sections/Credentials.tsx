/**
 * Certificates, courses and education, as short rows. The link is seen by MPI
 * only; to get a "Certificate checked" tick, add it under Checks.
 */

import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { Award, BookOpen, GraduationCap } from "lucide-react"
import { addCredential, removeCredential, updateCredential, type CredentialKind, type ProviderCredential } from "../../../services/data/providers"
import { TextInput } from "../../profile/parts"
import { numberOrNull, textOrNull } from "../../profile/useForm"
import { errorText } from "../../supplier/parts"
import SlideOver from "../SlideOver"
import { AddButton, EmptyLine, Group, PrivateBox, RowActions, SectionPanel, Segmented } from "../ui"
import type { SectionProps } from "./types"

const KINDS: { value: CredentialKind; label: string }[] = [
  { value: "certification", label: "Certification" },
  { value: "course", label: "Course" },
  { value: "education", label: "Education" },
]
const ICON = { certification: Award, course: BookOpen, education: GraduationCap }

export default function Credentials({ orgId, b, reload, toast }: SectionProps) {
  const [editing, setEditing] = useState<ProviderCredential | "new" | null>(null)
  const list = b.data.credentials
  return (
    <SectionPanel icon={GraduationCap} title="Certificates & education" subtitle="Courses, certifications and degrees that back up your skills." aside={<span className="text-[13px] font-semibold text-muted">{list.length} of 20</span>}>
      {list.length === 0 ? (
        <EmptyLine>Optional, but it helps startups trust your skills.</EmptyLine>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((x) => {
            const Icon = ICON[x.kind as CredentialKind] ?? Award
            return (
              <li key={x.id} className="flex items-start gap-3 rounded-xl border border-line/70 bg-white p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-tint text-navy">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted">{KINDS.find((k) => k.value === x.kind)?.label}</p>
                  <p className="font-bold leading-snug text-navy">{x.title}</p>
                  <p className="text-[13px] text-muted">{[x.issuer, x.year].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <RowActions
                  name={x.title}
                  onEdit={() => setEditing(x)}
                  onRemove={async () => {
                    await removeCredential(x.id)
                    await reload()
                    toast("Removed")
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
      {list.length < 20 && (
        <div className="mt-3">
          <AddButton onClick={() => setEditing("new")}>Add a certificate, course or degree</AddButton>
        </div>
      )}
      <AnimatePresence>
        {editing && (
          <CredentialEditor
            key={editing === "new" ? "new" : editing.id}
            item={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSave={async (row) => {
              if (editing === "new") await addCredential({ ...row, org_id: orgId })
              else await updateCredential(editing.id, row)
              await reload()
              toast(editing === "new" ? "Added" : "Saved")
              setEditing(null)
            }}
          />
        )}
      </AnimatePresence>
    </SectionPanel>
  )
}

type Row = Omit<Parameters<typeof addCredential>[0], "org_id">

function CredentialEditor({ item, onClose, onSave }: { item: ProviderCredential | null; onClose: () => void; onSave: (row: Row) => Promise<void> }) {
  const [v, setV] = useState({ kind: (item?.kind as CredentialKind) ?? "certification", title: item?.title ?? "", issuer: item?.issuer ?? "", year: item?.year?.toString() ?? "", link: item?.link ?? "" })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }))
  const thisYear = new Date().getFullYear()
  const titleError = tried && v.title.trim().length < 2 ? "Add the name." : null
  const yearError = v.year && (Number(v.year) < 1950 || Number(v.year) > thisYear + 6) ? "Check the year." : null
  const linkError = v.link && !/^https?:\/\/\S+$/i.test(v.link.trim()) ? "Start the link with https://" : null

  const save = async () => {
    setTried(true)
    if (v.title.trim().length < 2 || yearError || linkError) return
    setBusy(true)
    setError(null)
    try {
      await onSave({ kind: v.kind, title: v.title.trim(), issuer: textOrNull(v.issuer), year: numberOrNull(v.year), link: textOrNull(v.link) })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <SlideOver title={item ? "Edit" : "Add a certificate, course or degree"} onClose={onClose} onSave={() => void save()} saveLabel={item ? "Save" : "Add"} busy={busy} error={error}>
      <Group label="Kind">
        <Segmented label="Kind" options={KINDS} value={v.kind} onChange={(x) => set("kind", x)} />
      </Group>
      <TextInput label={v.kind === "education" ? "Degree or diploma" : "Name"} value={v.title} onChange={(x) => set("title", x)} maxLength={160} error={titleError} placeholder={v.kind === "education" ? "e.g. B.Des. Communication Design" : "e.g. Google UX Design Certificate"} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <TextInput label={v.kind === "education" ? "College or university" : "Given by"} value={v.issuer} onChange={(x) => set("issuer", x)} maxLength={160} />
        <TextInput label="Year" type="number" inputMode="numeric" value={v.year} onChange={(x) => set("year", x)} error={yearError} />
      </div>
      <PrivateBox note="MPI uses the link to check it, if you ask for a check.">
        <TextInput label="Link to the certificate" value={v.link} onChange={(x) => set("link", x)} maxLength={500} error={linkError} placeholder="https://" inputMode="url" />
      </PrivateBox>
    </SlideOver>
  )
}
