/**
 * Packages: fixed-price services ("Shopify store setup, ₹25,000, 10 days,
 * 2 revisions"). Rows open to show what's included and not; the slide-over
 * has a live preview of how startups see the package.
 */

import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { Clock, PackageCheck, RefreshCw } from "lucide-react"
import { addPackage, removePackage, updatePackage, type ProviderPackage } from "../../../services/data/providers"
import UiSwitch from "../../../ui/Switch"
import { SelectInput, TextInput } from "../../profile/parts"
import { errorText, rupees } from "../../supplier/parts"
import { PackageCard } from "../PublicProfile"
import SlideOver from "../SlideOver"
import { AddButton, EmptyLine, ExpandRow, Group, ListEditor, RowActions, SectionPanel, Stepper } from "../ui"
import type { SectionProps } from "./types"

export default function Packages({ orgId, b, reload, toast }: SectionProps) {
  const [editing, setEditing] = useState<ProviderPackage | "new" | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const list = b.data.packages
  return (
    <SectionPanel icon={PackageCheck} title="Packages" subtitle="Fixed-price services startups can ask for. Your price is what MPI matches against their budget." aside={<span className="text-[13px] font-semibold text-muted">{list.filter((k) => k.is_active).length} active · {list.length} of 10</span>}>
      <div className="space-y-2.5">
        {list.length === 0 && <EmptyLine>Add at least one package. Start with the work you're asked for most.</EmptyLine>}
        {list.map((k) => (
          <ExpandRow
            key={k.id}
            head={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15.5px] font-bold text-navy">{k.title}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
                    {b.categoryName(k.category_id)}
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} aria-hidden="true" /> {k.turnaround_days} days
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <RefreshCw size={12} aria-hidden="true" /> {k.revision_rounds} revision{k.revision_rounds === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <span className="font-display text-[19px] font-bold text-navy">{rupees(Number(k.price))}</span>
              </div>
            }
            actions={
              <>
                <span className="flex items-center gap-2 pr-1 text-[12.5px] font-semibold text-muted">
                  <span className="hidden sm:inline">{k.is_active ? "Active" : "Hidden"}</span>
                  <UiSwitch
                    on={k.is_active}
                    busy={busy === k.id}
                    label={`Show ${k.title} to startups`}
                    onChange={async () => {
                      setBusy(k.id)
                      try {
                        await updatePackage(k.id, { is_active: !k.is_active })
                        await reload()
                        toast(k.is_active ? "Package hidden" : "Package active")
                      } catch (err) {
                        toast(errorText(err))
                      } finally {
                        setBusy(null)
                      }
                    }}
                  />
                </span>
                <RowActions
                  name={k.title}
                  onEdit={() => setEditing(k)}
                  onRemove={async () => {
                    await removePackage(k.id)
                    await reload()
                    toast("Package removed")
                  }}
                />
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[12.5px] font-semibold text-muted">Included</p>
                <ul className="space-y-1 text-[14px] text-navy">{k.deliverables.length ? k.deliverables.map((d) => <li key={d}>✓ {d}</li>) : <li className="text-muted">Nothing listed</li>}</ul>
              </div>
              <div>
                <p className="mb-1 text-[12.5px] font-semibold text-muted">Not included</p>
                <ul className="space-y-1 text-[14px] text-muted">{k.exclusions.length ? k.exclusions.map((d) => <li key={d}>✕ {d}</li>) : <li>Nothing listed</li>}</ul>
              </div>
            </div>
          </ExpandRow>
        ))}
        {list.length < 10 && <AddButton onClick={() => setEditing("new")}>Add a service package</AddButton>}
      </div>
      <AnimatePresence>
        {editing && (
          <PackageEditor
            key={editing === "new" ? "new" : editing.id}
            item={editing === "new" ? null : editing}
            b={b}
            onClose={() => setEditing(null)}
            onSave={async (row) => {
              if (editing === "new") await addPackage({ ...row, org_id: orgId })
              else await updatePackage(editing.id, row)
              await reload()
              toast(editing === "new" ? "Package added" : "Package saved")
              setEditing(null)
            }}
          />
        )}
      </AnimatePresence>
    </SectionPanel>
  )
}

type Row = Omit<Parameters<typeof addPackage>[0], "org_id">

function PackageEditor({ item, b, onClose, onSave }: { item: ProviderPackage | null; b: SectionProps["b"]; onClose: () => void; onSave: (row: Row) => Promise<void> }) {
  const [v, setV] = useState({
    title: item?.title ?? "",
    category: item?.category_id ?? b.data.categoryIds.find((id) => b.categories.some((c) => c.id === id)) ?? "",
    price: item ? String(Number(item.price)) : "",
    days: item?.turnaround_days?.toString() ?? "",
    revisions: item?.revision_rounds ?? 2,
    included: item?.deliverables ?? [],
    excluded: item?.exclusions ?? [],
    active: item?.is_active ?? true,
  })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }))
  const price = Number(v.price)
  const days = Number(v.days)
  const errs = {
    title: tried && v.title.trim().length < 3 ? "Give the package a name." : null,
    category: tried && !v.category ? "Choose a category." : null,
    price: tried && !(price > 0) ? "Add a price in rupees." : null,
    days: tried && !(days >= 1 && days <= 365) ? "Between 1 and 365 days." : null,
  }

  const save = async () => {
    setTried(true)
    if (v.title.trim().length < 3 || !v.category || !(price > 0) || !(days >= 1 && days <= 365)) return
    setBusy(true)
    setError(null)
    try {
      await onSave({ title: v.title.trim(), category_id: v.category, price, turnaround_days: Math.round(days), revision_rounds: v.revisions, deliverables: v.included, exclusions: v.excluded, is_active: v.active })
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <SlideOver title={item ? "Edit package" : "Add a service package"} subtitle="A fixed price for a clear piece of work." onClose={onClose} onSave={() => void save()} saveLabel={item ? "Save package" : "Add package"} busy={busy} error={error}>
      <TextInput label="Package name" value={v.title} onChange={(x) => set("title", x)} maxLength={120} error={errs.title} placeholder="e.g. Shopify store setup" />
      <SelectInput label="Category" value={v.category} onChange={(x) => set("category", x)} options={b.categories.map((c) => ({ value: c.id, label: c.name }))} error={errs.category} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Price (₹)" type="number" inputMode="numeric" min={1} value={v.price} onChange={(x) => set("price", x)} error={errs.price} hint="Price the work fairly. You never see the startup's budget." />
        <TextInput label="Delivered in (days)" type="number" inputMode="numeric" min={1} max={365} value={v.days} onChange={(x) => set("days", x)} error={errs.days} />
      </div>
      <Group label="Revision rounds">
        <Stepper label="revision rounds" value={v.revisions} min={0} max={10} onChange={(x) => set("revisions", x)} />
      </Group>
      <ListEditor label="What's included" tone="in" values={v.included} onChange={(x) => set("included", x)} placeholder="e.g. Up to 15 products added" />
      <ListEditor label="Not included" tone="out" values={v.excluded} onChange={(x) => set("excluded", x)} placeholder="e.g. Product photos" />
      <label className="flex items-center justify-between gap-4 rounded-xl border border-line/70 bg-white px-4 py-3">
        <span>
          <span className="block font-semibold text-navy">Active on your profile</span>
          <span className="block text-[13px] text-muted">Hidden packages stay saved.</span>
        </span>
        <UiSwitch on={v.active} label="Active on your profile" onChange={() => set("active", !v.active)} />
      </label>
      <div>
        <p className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted">How startups see it</p>
        <PackageCard k={{ id: "preview", title: v.title || "Package name", category: b.categoryName(v.category || null), price: price > 0 ? price : 0, days: days > 0 ? Math.round(days) : 0, revisions: v.revisions, included: v.included, excluded: v.excluded }} />
      </div>
    </SlideOver>
  )
}
