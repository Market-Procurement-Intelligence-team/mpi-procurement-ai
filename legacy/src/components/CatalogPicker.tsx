import { useState } from "react"
import {
  CatalogService,
  CATALOG_CATEGORIES,
  MPI_CATALOG,
  searchCatalog,
} from "../lib/mpiCatalog"
import { DemoTag } from "./shared"

interface CatalogPickerProps {
  selected: string[]
  onToggle: (id: string) => void
  accentColor?: string
}

export function CatalogPicker({
  selected,
  onToggle,
  accentColor: _accentColor = "#0F2744",
}: CatalogPickerProps) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("All")

  const results = searchCatalog(MPI_CATALOG, query, category)
  const selectedServices = MPI_CATALOG.filter((s) => selected.includes(s.id))

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Solutions Directory
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Filter and select the procurement categories relevant to your needs.
          </div>
        </div>
        <DemoTag label={`${MPI_CATALOG.length} Catalog Offerings`} />
      </div>

      {/* Search Input */}
      <div className="relative mb-3.5">
        <svg
          width="15"
          height="15"
          viewBox="0 0 20 20"
          fill="none"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        >
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M13.5 13.5L17 17"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter solutions (e.g., custom cartons, 3D printing, QA testing)..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm outline-none transition-all focus:border-[#051F16] focus:ring-2 focus:ring-emerald-100 bg-white text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["All", ...CATALOG_CATEGORIES] as const).map((cat) => {
          const isActive = category === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`text-xs px-3 py-1 rounded-md border font-medium transition-all ${
                isActive
                  ? "bg-[#051F16] text-[#A3F65C] border-[#051F16] shadow-2xs font-semibold"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 max-h-95 overflow-y-auto pr-1">
        {results.map((service) => {
          const isSelected = selected.includes(service.id)
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onToggle(service.id)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? "border-[#051F16] bg-emerald-50/50 shadow-xs ring-1 ring-[#051F16]/30"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-sm font-semibold text-slate-900">
                  {service.name}
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                    isSelected
                      ? "bg-[#051F16] border-[#051F16] text-[#A3F65C]"
                      : "bg-white border-slate-300"
                  }`}
                >
                  {isSelected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {service.category}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {service.description}
              </p>
            </button>
          )
        })}
        {results.length === 0 && (
          <div className="col-span-full text-center text-sm text-slate-400 py-10">
            No solutions matched your search.
          </div>
        )}
      </div>

      {/* Selected summary */}
      <div className="pt-3 border-t border-slate-100">
        <div className="text-xs font-semibold text-slate-700 mb-2">
          Selected Offerings ({selectedServices.length})
        </div>
        {selectedServices.length === 0 ? (
          <p className="text-xs text-slate-400">
            No offerings selected yet. Click any solution above to add.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedServices.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200"
              >
                {s.name}
                <button
                  type="button"
                  onClick={() => onToggle(s.id)}
                  className="text-slate-400 hover:text-slate-700 font-bold ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export type { CatalogService }
