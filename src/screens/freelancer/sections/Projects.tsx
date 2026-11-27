/**
 * Projects: past work as rows that open to show more. Add or edit in the
 * slide-over. The client's name and the link are seen by MPI only; startups
 * see the kind of client instead.
 */

import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { FolderKanban, Sparkles } from "lucide-react"
import { addProject, removeProject, updateProject, type ProviderProject } from "../../../services/data/providers"
import { SelectInput, TagsInput, TextArea, TextInput } from "../../profile/parts"
import { numberOrNull, textOrNull } from "../../profile/useForm"
import { errorText } from "../../supplier/parts"
import SlideOver from "../SlideOver"
import { AddButton, EmptyLine, ExpandRow, PrivateBox, PrivateTag, RowActions, SectionPanel } from "../ui"
import type { SectionProps } from "./types"

const blank = { title: "", category: "", clientKind: "", work: "", tools: [] as string[], result: "", year: "", clientName: "", link: "" }

export default function Projects({ b, orgId, reload, toast }: SectionProps) {
  const [editing, setEditing] = useState<ProviderProject | "new" | null>(null)
  const list = b.data.projects
  return (
    <SectionPanel icon={FolderKanban} title="Projects" subtitle="Work you've done. Startups see the kind of client, never the name." aside={<span className="text-[13px] font-semibold text-muted">{list.length} of 20</span>}>
      <div className="space-y-2.5">
        {list.length === 0 && <EmptyLine>Add 2 or 3 projects that show your best work.</EmptyLine>}
        {list.map((x) => (
          <ExpandRow
            key={x.id}
            head={
              <>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[15.5px] font-bold text-navy">{x.title}</span>
                  {b.categoryName(x.category_id) && <span className="rounded-full bg-navy-tint px-2 py-0.5 text-[12px] font-semibold text-navy">{b.categoryName(x.category_id)}</span>}
                  {x.year && <span className="text-[13px] text-muted">{x.year}</span>}
                </p>
                {x.result && (
                  <p className="mt-1 flex items-start gap-1.5 text-[13.5px] text-navy">
                    <Sparkles size={14} className="mt-0.5 shrink-0 text-orange-2" aria-hidden="true" /> {x.result}
                  </p>
                )}
              </>
            }
            actions={
              <RowActions
                name={x.title}
                onEdit={() => setEditing(x)}
                onRemove={async () => {
                  await removeProject(x.id)
                  await reload()
                  toast("Project removed")
                }}
              />
            }
          >
            <dl className="grid gap-3 text-[14px] sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-[12.5px] font-semibold text-muted">Your role and what you did</dt>
                <dd className="text-ink">{x.role_and_work || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-semibold text-muted">Kind of client (startups see this)</dt>
                <dd className="text-ink">{x.client_kind || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-semibold text-muted">Tools</dt>
                <dd className="text-ink">{x.tools.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">Client name <PrivateTag /></dt>
                <dd className="text-ink">{x.client_name || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">Link <PrivateTag /></dt>
                <dd className="truncate text-ink">{x.link || "—"}</dd>
              </div>
            </dl>
          </ExpandRow>
        ))}
        {list.length < 20 && <AddButton onClick={() => setEditing("new")}>Add a project</AddButton>}
      </div>

      <AnimatePresence>
        {editing && (
          <ProjectEditor
            key={editing === "new" ? "new" : editing.id}
            item={editing === "new" ? null : editing}
            b={b}
            onClose={() => setEditing(null)}
            onSave={async (row) => {
              if (editing === "new") await addProject({ ...row, org_id: orgId })
              else await updateProject(editing.id, row)
              await reload()
              toast(editing === "new" ? "Project added" : "Project saved")
              setEditing(null)
            }}
          />
        )}
      </AnimatePresence>
    </SectionPanel>
  )
}

type ProjectRow = Omit<Parameters<typeof addProject>[0], "org_id">

function ProjectEditor({ item, b, onClose, onSave }: { item: ProviderProject | null; b: SectionProps["b"]; onClose: () => void; onSave: (row: ProjectRow) => Promise<void> }) {
  const [v, setV] = useState(
    item
      ? { title: item.title, category: item.category_id ?? "", clientKind: item.client_kind ?? "", work: item.role_and_work ?? "", tools: item.tools, result: item.result ?? "", year: item.year?.toString() ?? "", clientName: item.client_name ?? "", link: item.link ?? "" }
      : blank,
  )
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }))
  const thisYear = new Date().getFullYear()
  const titleError = tried && v.title.trim().length < 2 ? "Give the project a title." : null
  const yearError = v.year && (Number(v.year) < 1980 || Number(v.year) > thisYear + 1) ? `Between 1980 and ${thisYear + 1}.` : null
  const linkError = v.link && !/^https?:\/\/\S+$/i.test(v.link.trim()) ? "Start the link with https://" : null

  const save = async () => {
    setTried(true)
    if (v.title.trim().length < 2 || yearError || linkError) return
    setBusy(true)
    setError(null)
    try {
      await onSave({
        title: v.title.trim(),
        category_id: v.category || null,
        client_kind: textOrNull(v.clientKind),
        role_and_work: textOrNull(v.work),
        tools: v.tools,
        result: textOrNull(v.result),
        year: numberOrNull(v.year),
        client_name: textOrNull(v.clientName),
        link: textOrNull(v.link),
      })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <SlideOver title={item ? "Edit project" : "Add a project"} subtitle="Show the work and the result. Keep names out of the public fields." onClose={onClose} onSave={() => void save()} saveLabel={item ? "Save project" : "Add project"} busy={busy} error={error}>
      <TextInput label="Project title" value={v.title} onChange={(x) => set("title", x)} maxLength={120} error={titleError} placeholder="e.g. Shopify store for a millet snacks brand" />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <SelectInput label="Category" value={v.category} onChange={(x) => set("category", x)} options={b.categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose a category" />
        <TextInput label="Year" type="number" inputMode="numeric" value={v.year} onChange={(x) => set("year", x)} error={yearError} />
      </div>
      <TextInput label="Kind of client" value={v.clientKind} onChange={(x) => set("clientKind", x)} maxLength={120} placeholder="e.g. D2C food startup" hint="Startups see this instead of the client's name." />
      <TextArea label="Your role and what you did" value={v.work} onChange={(x) => set("work", x)} rows={4} maxLength={1500} />
      <TagsInput label="Tools used" values={v.tools} onChange={(x) => set("tools", x)} placeholder="Add a tool" max={15} />
      <TextInput label="Result" value={v.result} onChange={(x) => set("result", x)} maxLength={500} placeholder="e.g. Orders went up 40% in 3 months" />
      <PrivateBox>
        <TextInput label="Client name" value={v.clientName} onChange={(x) => set("clientName", x)} maxLength={200} />
        <TextInput label="Link to the work" value={v.link} onChange={(x) => set("link", x)} maxLength={500} error={linkError} placeholder="https://" inputMode="url" />
      </PrivateBox>
    </SlideOver>
  )
}
