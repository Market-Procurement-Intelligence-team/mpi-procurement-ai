import React, { useMemo, useState, useEffect } from "react"
import { CatalogCategory } from "../../lib/mpiCatalog"
import {
  CATEGORIES_METADATA,
  ENRICHED_CATALOG_PRODUCTS,
} from "./catalogueData"
import { EnrichedCatalogProduct } from "./catalogue.types"
import CategorySelector from "./CategorySelector"
import ProductRail from "./ProductRail"
import CatalogueNavigation from "./CatalogueNavigation"
import ProductDetailsModal from "./ProductDetailsModal"
import MaterialIcon from "../ui/MaterialIcon"
import { MPIButton } from "../design-system/MPIDesignSystem"
import ProductionStateCard from "../ui/ProductionStateCard"

interface ProductCatalogueProps {
  onQuoteProduct: (product: EnrichedCatalogProduct) => void
  onAskAI: (query?: string, category?: string) => void
  onExploreWorkspace: () => void
}

export const ProductCatalogue: React.FC<ProductCatalogueProps> = ({
  onQuoteProduct,
  onAskAI,
  onExploreWorkspace,
}) => {
  // Category state (Level 1) initialized from shareable URL query if present (Section 12)
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const catParam = params.get("category")
      const matched = CATEGORIES_METADATA.find(
        (c) => c.id.toLowerCase() === (catParam || "").toLowerCase(),
      )
      if (matched) return matched.id as CatalogCategory
    }
    return "Packaging & Printing"
  })
  const [isTransitioningCategory, setIsTransitioningCategory] = useState(false)

  // Rail scroll index (Level 2)
  const [currentRailIndex, setCurrentRailIndex] = useState(0)

  // Search filter query initialized from URL if present (Section 12)
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      return params.get("search") || ""
    }
    return ""
  })

  // Synchronize state back to browser URL for shareability (Section 12)
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (selectedCategory) {
      params.set("category", selectedCategory)
    }
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim())
    } else {
      params.delete("search")
    }
    const newSearch = params.toString()
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash || ""}`
    window.history.replaceState(null, "", newUrl)
  }, [selectedCategory, searchQuery])

  // Product detail modal state
  const [modalProduct, setModalProduct] = useState<EnrichedCatalogProduct | null>(
    null,
  )

  // Dynamic product count per category
  const productCounts = useMemo(() => {
    const counts: Record<CatalogCategory, number> = {} as any
    CATEGORIES_METADATA.forEach((cat) => {
      counts[cat.id] = ENRICHED_CATALOG_PRODUCTS.filter(
        (p) => p.category === cat.id,
      ).length
    })
    return counts
  }, [])

  // Active category metadata
  const currentCategoryMeta = useMemo(() => {
    return (
      CATEGORIES_METADATA.find((c) => c.id === selectedCategory) ||
      CATEGORIES_METADATA[0]
    )
  }, [selectedCategory])

  // Filtered products for active category and optional query
  const displayedProducts = useMemo(() => {
    let list = ENRICHED_CATALOG_PRODUCTS.filter(
      (p) => p.category === selectedCategory,
    )
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      )
    }
    return list
  }, [selectedCategory, searchQuery])

  // Category change handler with smooth fade/slide transition
  const handleSelectCategory = (newCategory: CatalogCategory) => {
    if (newCategory === selectedCategory) return

    // 1. Trigger smooth fade out
    setIsTransitioningCategory(true)

    // 2. Switch category and reset rail to index 0 after brief exit delay
    setTimeout(() => {
      setSelectedCategory(newCategory)
      setCurrentRailIndex(0)
      setSearchQuery("")

      // 3. Trigger smooth entrance from side
      setTimeout(() => {
        setIsTransitioningCategory(false)
      }, 50)
    }, 220)
  }

  // Navigation button handlers
  const handleScrollLeft = () => {
    setCurrentRailIndex((prev) => Math.max(0, prev - 1))
  }

  const handleScrollRight = () => {
    setCurrentRailIndex((prev) =>
      Math.min(displayedProducts.length - 1, prev + 1),
    )
  }

  return (
    <section
      id="marketplace"
      className="relative overflow-hidden py-16 lg:py-24 bg-linear-to-b from-white via-slate-50/70 to-white border-y border-slate-200/90 scroll-reveal"
    >
      {/* ─── SUBTLE PROCUREMENT NETWORK BACKGROUND (Low Opacity Grid & Gradients) ─── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#051F16_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-linear-to-r from-[#A3F65C]/15 via-emerald-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ─── SECTION HEADER (Premium Apple / SaaS Style) ────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-3 max-w-2xl">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
              <MaterialIcon name="inventory_2" size={15} className="text-[#051F16]" />
              <span className="font-mono text-[11px] uppercase tracking-wider">Product & Service Catalogue</span>
            </div>

            {/* Headline */}
            <h2
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#051F16] tracking-tight leading-tight"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Everything your business needs to{" "}
              <span className="font-editorial italic font-normal text-[#083A28]">
                build, operate & scale.
              </span>
            </h2>

            {/* Description */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Explore 7 approved procurement verticals and 75+ institutional-grade
              offerings vetted with statutory ZED, ISO, and reverse-margin guarantees.
            </p>
          </div>

          {/* Quick Search within Catalogue */}
          <div className="w-full md:w-80">
            <div className="relative">
              <MaterialIcon
                name="search"
                size={18}
                className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentRailIndex(0)
                }}
                placeholder="Search within catalogue..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-2xl focus:border-[#051F16] focus:ring-4 focus:ring-emerald-100/60 outline-none shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── LEVEL 1: CATEGORY NAVIGATION (Tabs Rail) ────────────────────────── */}
        <div className="mb-6">
          <CategorySelector
            categories={CATEGORIES_METADATA}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            productCounts={productCounts}
            disabled={isTransitioningCategory}
          />
        </div>

        {/* ─── CATEGORY INTRO BANNER ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                {currentCategoryMeta.displayName}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-semibold">
                {productCounts[selectedCategory]} Offerings Ready for RFQ
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-snug">
              {currentCategoryMeta.description}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <MPIButton
              variant="outline"
              size="sm"
              onClick={onExploreWorkspace}
              icon={<MaterialIcon name="tune" size={14} />}
            >
              Custom Spec Builder
            </MPIButton>
          </div>
        </div>

        {/* ─── LEVEL 2: DYNAMIC PRODUCT COUNT & MINIMALIST NAVIGATION ─────────── */}
        <CatalogueNavigation
          currentIndex={currentRailIndex}
          totalCount={displayedProducts.length}
          visibleCardsCount={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 3}
          canScrollLeft={currentRailIndex > 0}
          canScrollRight={currentRailIndex < displayedProducts.length - 1}
          onScrollLeft={handleScrollLeft}
          onScrollRight={handleScrollRight}
          categoryName={currentCategoryMeta.displayName}
          onExploreWorkspace={onExploreWorkspace}
        />

        {/* ─── LEVEL 2: HORIZONTAL SIDE-SCROLLING PRODUCT RAIL ────────────────── */}
        {displayedProducts.length > 0 ? (
          <div className="relative">
            <ProductRail
              products={displayedProducts}
              currentIndex={currentRailIndex}
              onIndexChange={setCurrentRailIndex}
              isTransitioningCategory={isTransitioningCategory}
              onViewDetails={(prod) => setModalProduct(prod)}
              onRequestQuote={(prod) => onQuoteProduct(prod)}
            />
          </div>
        ) : (
          <ProductionStateCard
            mode="empty"
            title={`No offerings found matching "${searchQuery}"`}
            description={`We could not locate items in ${currentCategoryMeta.displayName} matching your specific filter.`}
            emptyReason={`No pre-catalogued specifications match the keyword "${searchQuery}".`}
            actionLabel="Clear Search Filter"
            onAction={() => setSearchQuery("")}
            secondaryActionLabel="Ask AI to Source"
            onSecondaryAction={() => onAskAI(searchQuery, selectedCategory)}
          />
        )}

        {/* ─── 13. CAN'T FIND WHAT YOU NEED? ASK MPI AI WORKFLOW CTA ─────────── */}
        <div className="mt-12 bg-[#051F16] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[#0A3525]">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A3525] text-[#A3F65C] text-xs font-bold border border-emerald-900/60">
              <MaterialIcon name="smart_toy" size={14} className="text-[#A3F65C]" />
              <span>Custom & Specialized Procurement</span>
            </div>
            <h3
              className="text-xl sm:text-2xl font-extrabold text-white tracking-tight"
              style={{ fontFamily: "Plus Jakarta Sans" }}
            >
              Can't find your exact specification in the catalogue?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Our AI Procurement Co-Founder converts plain technical requirements or
              CAD sketches into institutional RFQs, matching with 1,200+ verified MSMEs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <MPIButton
              variant="secondary"
              size="md"
              onClick={onExploreWorkspace}
            >
              Open Full Workspace
            </MPIButton>

            <MPIButton
              variant="primary"
              size="md"
              onClick={() => onAskAI("Need custom procurement specifications for specialized requirement", selectedCategory)}
              icon={<MaterialIcon name="auto_awesome" size={16} />}
            >
              Ask MPI AI Spec Engine →
            </MPIButton>
          </div>
        </div>
      </div>

      {/* ─── MODAL: PRODUCT DETAILS ─────────────────────────────────────────── */}
      <ProductDetailsModal
        product={modalProduct}
        onClose={() => setModalProduct(null)}
        onRequestQuote={(prod) => {
          setModalProduct(null)
          onQuoteProduct(prod)
        }}
        onAskAI={(prod) => {
          setModalProduct(null)
          onAskAI(`Need custom sourcing RFQ for ${prod.name} (${prod.category}) with reverse-margin guarantees.`, prod.category)
        }}
      />
    </section>
  )
}
export default ProductCatalogue
