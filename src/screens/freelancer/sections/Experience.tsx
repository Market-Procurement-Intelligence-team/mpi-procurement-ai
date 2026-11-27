/**
 * Experience: past jobs as a timeline. The company name is seen by MPI only;
 * startups see the kind of company.
 */

import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { BriefcaseBusiness } from "lucide-react"
import { addExperience, removeExperience, updateExperience, type ProviderExperience } from "../../../services/data/providers"
import { TextArea, TextInput } from "../../profile/parts"
import { textOrNull } from "../../profile/useForm"
import { errorText } from "../../supplier/parts"
import SlideOver from "../SlideOver"
import { AddButton, EmptyLine, PrivateBox, PrivateTag, RowActions, SectionPanel } from "../ui"
import { monthYear } from "../useBuilder"
import type { SectionProps } from "./types"

export default function Experience({ orgId, b, reload, toast }: SectionProps) {
  const [editing, setEditing] = useState<ProviderExperience | "new" | null>(null)
  const list = b.data.experience
  return (
    <SectionPanel icon={BriefcaseBusiness} title="Experience" subtitle="Jobs and long contracts. Startups see the kind of company, never its name." aside={<span className="text-[13px] font-semibold text-muted">{list.length} of 20</span>}>
      {list.length === 0 ? (
        <EmptyLine>Add your past jobs, including freelancing on your own.</EmptyLine>
      ) : (
        <ol className="relative ml-2 space-y-3 border-l-2 border-line pl-5">
          {list.map((x) => (
            <li key={x.id} className="relative rounded-xl border border-line/70 bg-white px-4 py-3">
              <span className={`absolute top-4 size-3 rounded-full ring-4 ring-white ${x.ended_on ? "bg-input" : "bg-orange"}`} style={{ left: -28 }} aria-hidden="true" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-muted">
                    {monthYear(x.started_on)} – {x.ended_on ? monthYear(x.ended_on) : <span className="rounded-full bg-orange-tint px-2 py-px font-bold text-navy">Current</span>}
                  </p>
                  <p className="font-bold text-navy">{x.role_title}</p>
                  <p className="text-[13.5px] text-muted">{x.company_kind || "Kind of company not added"}</p>
                  {x.company_name && (
                    <p className="mt-0.5 flex items-center gap-2 text-[13px] text-ink">
                      {x.company_name} <PrivateTag />
                    </p>
                  )}
                  {x.description && <p className="mt-1.5 text-[14px] text-ink">{x.description}</p>}
                </div>
                <RowActions
                  name={x.role_title}
                  onEdit={() => setEditing(x)}
                  onRemove={async () => {
                    await removeExperience(x.id)
                    await reload()
                    toast("Job removed")
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      {list.length < 20 && (
        <div className="mt-3">
          <AddButton onClick={() => setEditing("new")}>Add work experience</AddButton>
        </div>
      )}
      <AnimatePresence>
        {editing && (
          <ExperienceEditor
            key={editing === "new" ? "new" : editing.id}
            item={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSave={async (row) => {
              if (editing === "new") await addExperience({ ...row, org_id: orgId })
              else await updateExperience(editing.id, row)
              await reload()
              toast(editing === "new" ? "Job added" : "Job saved")
              setEditing(null)
            }}
          />
        )}
      </AnimatePresence>
    </SectionPanel>
  )
}

type Row = Omit<Parameters<typeof addExperience>[0], "org_id">
const toMonth = (iso: string | null) => (iso ? iso.slice(0, 7) : "")

function ExperienceEditor({ item, onClose, onSave }: { item: ProviderExperience | null; onClose: () => void; onSave: (row: Row) => Promise<void> }) {
  const [v, setV] = useState({
    role: item?.role_title ?? "",
    kind: item?.company_kind ?? "",
    company: item?.company_name ?? "",
    from: toMonth(item?.started_on ?? null),
    to: toMonth(item?.ended_on ?? null),
    current: item ? !item.ended_on : false,
    description: item?.description ?? "",
  })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }))
  const roleError = tried && v.role.trim().length < 2 ? "Add your role." : null
  const fromError = tried && !v.from ? "Add when you started." : null
  const toError = !v.current && v.to && v.from && v.to < v.from ? "Ends before it starts." : tried && !v.current && !v.to ? "Add when it ended, or tick that you still work here." : null

  const save = async () => {
    setTried(true)
    if (v.role.trim().length < 2 || !v.from || (!v.current && (!v.to || v.to < v.from))) return
    setBusy(true)
    setError(null)
    try {
      await onSave({
        role_title: v.role.trim(),
        company_kind: textOrNull(v.kind),
        company_name: textOrNull(v.company),
        started_on: `${v.from}-01`,
        ended_on: v.current ? null : `${v.to}-01`,
        description: textOrNull(v.description),
      })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <SlideOver title={item ? "Edit work experience" : "Add work experience"} subtitle="A job, a long contract, or your own freelancing." onClose={onClose} onSave={() => void save()} saveLabel={item ? "Save" : "Add"} busy={busy} error={error}>
      <TextInput label="Role" value={v.role} onChange={(x) => set("role", x)} maxLength={120} error={roleError} placeholder="e.g. Product designer" />
      <TextInput label="Kind of company" value={v.kind} onChange={(x) => set("kind", x)} maxLength={120} placeholder="e.g. E-commerce agency, 40 people" hint="Startups see this instead of the company's name." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="From" type="month" value={v.from} onChange={(x) => set("from", x)} error={fromError} />
        <TextInput label="To" type="month" value={v.current ? "" : v.to} onChange={(x) => set("to", x)} disabled={v.current} error={v.current ? null : toError} />
      </div>
      <label className="flex items-center gap-2.5 text-[14.5px] font-semibold text-navy">
        <input type="checkbox" checked={v.current} onChange={(e) => set("current", e.target.checked)} className="size-5 accent-[#ec8d49]" />I still work here
      </label>
      <TextArea label="What you did" value={v.description} onChange={(x) => set("description", x)} rows={4} maxLength={1500} />
      <PrivateBox>
        <TextInput label="Company name" value={v.company} onChange={(x) => set("company", x)} maxLength={200} />
      </PrivateBox>
    </SlideOver>
  )
}
