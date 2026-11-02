import { Check, Plus, Sparkles, Trash2 } from "lucide-react"
import type { CatalogueItem, Category } from "../../../services/data/catalogue"
import Button from "../../../ui/Button"
import { Alert, BOX, boxBorder, ErrorText, Field } from "../../../ui/form"
import { emptyItem, newKey, type DraftItem, type Errors, type WizardDraft } from "./draft"

const UNITS = ["units", "pieces", "boxes", "sheets", "rolls", "kg", "metres", "sets", "hours", "days", "months", "projects"]

export default function ItemsStep({
  draft,
  update,
  categories,
  catalogueItems,
  errors,
}: {
  draft: WizardDraft
  update: (patch: Partial<WizardDraft>) => void
  categories: Category[] | null
  catalogueItems: CatalogueItem[] | null
  errors: Errors
}) {
  const setItem = (key: string, patch: Partial<DraftItem>) =>
    update({ items: draft.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) })
  const removeItem = (key: string) => update({ items: draft.items.filter((item) => item.key !== key) })
  const addItem = () => update({ items: [...draft.items, emptyItem()] })

  const added = new Set(draft.items.map((item) => item.itemId).filter(Boolean))
  const toggleCatalogueItem = (item: CatalogueItem) => {
    if (added.has(item.id)) {
      update({ items: draft.items.filter((line) => line.itemId !== item.id) })
      return
    }
    // Replace a blank row instead of adding below it.
    const blank = draft.items.find((line) => !line.description.trim() && !line.itemId)
    const line: DraftItem = {
      key: blank?.key ?? newKey(),
      itemId: item.id,
      itemName: item.name,
      description: item.name,
      quantity: blank?.quantity ?? "",
      unit: item.unit && item.unit !== "unit" ? item.unit : "units",
    }
    update({ items: blank ? draft.items.map((l) => (l.key === blank.key ? line : l)) : [...draft.items, line] })
  }

  const fromAi = draft.aiReading !== null && draft.aiReadText === draft.text

  return (
    <div className="space-y-6">
      {fromAi && (
        <Alert tone="info">
          <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          The AI found {draft.aiReading?.lines.length ?? 0} {draft.aiReading?.lines.length === 1 ? "item" : "items"} in your
          text. Check the names and quantities, and change anything that's wrong.
        </Alert>
      )}

      <section className="rounded-xl border-[1.5px] border-line bg-white p-5 shadow-[0_1px_3px_rgba(21,35,61,0.08)] sm:p-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:items-start">
          <Field label="Group" hint="Helps MPI find the right suppliers.">
            {(a) => (
              <select
                {...a}
                value={draft.categoryId ?? ""}
                onChange={(e) => update({ categoryId: e.target.value || null })}
                className={`${BOX} ${boxBorder()} h-12`}
              >
                <option value="">Choose a group</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-navy">Add from this group</p>
            {!draft.categoryId ? (
              <p className="flex min-h-12 items-center text-[15px] text-muted">Choose a group to see its items.</p>
            ) : catalogueItems === null ? (
              <div className="flex flex-wrap gap-2" aria-label="Loading items">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="h-9 w-32 animate-pulse rounded-full bg-navy-tint" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {catalogueItems.map((item) => {
                  const on = added.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCatalogueItem(item)}
                      aria-pressed={on}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-sm font-semibold transition-colors ${
                        on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"
                      }`}
                    >
                      {on ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                      {item.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)]">
        <div className="flex items-baseline justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <h2 className="text-lg font-bold text-navy">Items and quantities</h2>
          <p className="text-sm text-muted">
            {draft.items.length} {draft.items.length === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_140px_150px_44px] gap-3 border-y border-line bg-navy-tint/60 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-muted md:grid">
          <span>Item and details</span>
          <span>Quantity</span>
          <span>Unit</span>
          <span className="sr-only">Remove</span>
        </div>

        {draft.items.length === 0 ? (
          <p className="px-5 py-6 text-[15px] text-muted sm:px-6">No items yet. Add one from the group above, or add your own below.</p>
        ) : (
          <ul className="divide-y divide-line">
            {draft.items.map((item, i) => {
              const descError = errors[`${item.key}.description`]
              const qtyError = errors[`${item.key}.quantity`]
              return (
                <li key={item.key} className="grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_140px_150px_44px] md:items-start">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-navy md:sr-only" htmlFor={`desc-${item.key}`}>
                      Item {i + 1}
                    </label>
                    <input
                      id={`desc-${item.key}`}
                      value={item.description}
                      onChange={(e) => setItem(item.key, { description: e.target.value })}
                      placeholder="What is it? Size, material, print…"
                      maxLength={300}
                      aria-invalid={descError ? true : undefined}
                      className={`${BOX} ${boxBorder(descError)} h-12`}
                    />
                    <p className="mt-1 text-xs text-muted">
                      {item.itemName ? `From the catalogue: ${item.itemName}` : "Not in the catalogue. MPI will still look for suppliers."}
                    </p>
                    {descError && <ErrorText>{descError}</ErrorText>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:contents">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-navy md:sr-only" htmlFor={`qty-${item.key}`}>
                        Quantity
                      </label>
                      <input
                        id={`qty-${item.key}`}
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) => setItem(item.key, { quantity: e.target.value.replace(/[^\d.,]/g, "") })}
                        aria-invalid={qtyError ? true : undefined}
                        className={`${BOX} ${boxBorder(qtyError)} h-12 text-right tabular-nums`}
                      />
                      {qtyError && <ErrorText>{qtyError}</ErrorText>}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-navy md:sr-only" htmlFor={`unit-${item.key}`}>
                        Unit
                      </label>
                      <input
                        id={`unit-${item.key}`}
                        list="mpi-units"
                        value={item.unit}
                        onChange={(e) => setItem(item.key, { unit: e.target.value })}
                        maxLength={30}
                        className={`${BOX} ${boxBorder()} h-12`}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="flex h-11 items-center justify-center gap-2 justify-self-start rounded-md px-2 text-sm font-semibold text-muted hover:bg-red-tint hover:text-red-text md:size-11 md:justify-self-auto"
                    aria-label={`Remove item ${i + 1}`}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                    <span className="md:hidden">Remove</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <datalist id="mpi-units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <div className="border-t border-line p-4 sm:px-6">
          <Button variant="secondary" onClick={addItem}>
            <Plus size={18} aria-hidden="true" />
            Add another item
          </Button>
          {errors.items && <ErrorText>{errors.items}</ErrorText>}
        </div>
      </section>
    </div>
  )
}
