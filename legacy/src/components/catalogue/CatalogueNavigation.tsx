import React from "react"
import MaterialIcon from "../ui/MaterialIcon"

interface CatalogueNavigationProps {
  currentIndex: number
  totalCount: number
  visibleCardsCount: number
  canScrollLeft: boolean
  canScrollRight: boolean
  onScrollLeft: () => void
  onScrollRight: () => void
  categoryName: string
  onExploreWorkspace?: () => void
}

export const CatalogueNavigation: React.FC<CatalogueNavigationProps> = ({
  currentIndex,
  totalCount,
  visibleCardsCount,
  canScrollLeft,
  canScrollRight,
  onScrollLeft,
  onScrollRight,
  categoryName,
  onExploreWorkspace,
}) => {
  const currentDisplayStart = Math.min(currentIndex + 1, totalCount)
  const currentDisplayEnd = Math.min(currentIndex + visibleCardsCount, totalCount)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-slate-100 mb-6">
      {/* Left: Dynamic Product Counter & Status */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            Showing <strong className="text-slate-900">{currentDisplayStart}–{currentDisplayEnd}</strong> of{" "}
            <strong className="text-[#051F16]">{totalCount}</strong> in {categoryName}
          </span>
        </div>

        {totalCount > 6 && onExploreWorkspace && (
          <button
            type="button"
            onClick={onExploreWorkspace}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer hidden md:inline-flex items-center gap-1"
          >
            <span>Workspace View</span>
            <MaterialIcon name="open_in_new" size={13} />
          </button>
        )}
      </div>

      {/* Right: Minimalist Apple/Enterprise Navigation Controls */}
      <div className="flex items-center gap-3 self-end sm:self-auto">
        <div className="text-[11px] font-medium text-slate-400 hidden lg:block">
          Use ← → keys, drag or wheel to scroll
        </div>

        <div className="flex items-center gap-1.5">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={onScrollLeft}
            disabled={!canScrollLeft}
            aria-label="Previous products"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
              canScrollLeft
                ? "bg-white border border-slate-200 hover:border-[#051F16] hover:bg-[#051F16] hover:text-white text-slate-800 shadow-2xs hover:shadow-sm"
                : "bg-slate-100 text-slate-300 border border-transparent cursor-not-allowed"
            }`}
          >
            <MaterialIcon name="arrow_back" size={18} />
          </button>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={onScrollRight}
            disabled={!canScrollRight}
            aria-label="Next products"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
              canScrollRight
                ? "bg-white border border-slate-200 hover:border-[#051F16] hover:bg-[#051F16] hover:text-white text-slate-800 shadow-2xs hover:shadow-sm"
                : "bg-slate-100 text-slate-300 border border-transparent cursor-not-allowed"
            }`}
          >
            <MaterialIcon name="arrow_forward" size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
export default CatalogueNavigation
