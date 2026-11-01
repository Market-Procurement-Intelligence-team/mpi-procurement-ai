import React, { useState } from "react"
import { EnrichedCatalogProduct } from "./catalogue.types"
import MaterialIcon from "../ui/MaterialIcon"

interface ProductCardProps {
  product: EnrichedCatalogProduct
  isActive?: boolean
  isCenter?: boolean
  onViewDetails: (product: EnrichedCatalogProduct) => void
  onRequestQuote: (product: EnrichedCatalogProduct) => void
  className?: string
  style?: React.CSSProperties
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isActive = false,
  isCenter = false,
  onViewDetails,
  onRequestQuote,
  className = "",
  style,
}) => {
  const [imageError, setImageError] = useState(false)
  const imageSrc = imageError ? product.image : product.highResImage || product.image

  return (
    <div
      style={style}
      className={`group relative bg-white rounded-3xl border transition-all duration-300 ease-out flex flex-col justify-between overflow-hidden select-none shrink-0 ${
        isCenter || isActive
          ? "border-[#051F16] shadow-[0_20px_40px_-10px_rgba(5,31,22,0.12)] ring-1 ring-[#051F16]/20"
          : "border-slate-200/90 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-1"
      } ${className}`}
    >
      {/* Top Media Image Container */}
      <div className="relative h-44 sm:h-48 w-full bg-slate-100 overflow-hidden">
        {imageError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-slate-400">
            <MaterialIcon name="inventory_2" size={34} className="text-slate-400 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {product.category.split("&")[0]}
            </span>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 will-change-transform"
          />
        )}

        {/* Soft Vignette Gradient for text contrast */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/95 backdrop-blur-md text-[#051F16] shadow-2xs border border-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            MPI Verified
          </span>

          {product.badge && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#051F16]/90 backdrop-blur-md text-[#A3F65C] shadow-2xs border border-[#A3F65C]/20">
              {product.badge}
            </span>
          )}
        </div>

        {/* Category Pill at Bottom of Image */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="text-[11px] font-bold text-white/90 bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded-lg border border-white/10 truncate max-w-[200px]">
            {product.category.split("&")[0]}
          </span>
          <span className="text-[10px] font-semibold text-white/80 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg">
            {product.startingPrice}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Supplier Trust Badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <MaterialIcon name="verified_user" size={12} className="text-emerald-700" />
            </span>
            <span className="text-[11px] font-bold text-slate-700">
              {product.supplierBadge}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              • ZED & Udyam Audited
            </span>
          </div>

          {/* Product Title */}
          <h3
            className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight line-clamp-1 group-hover:text-[#051F16] transition-colors mb-1.5"
            style={{ fontFamily: "Plus Jakarta Sans" }}
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Description */}
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3.5">
            {product.description}
          </p>

          {/* Key Attributes Box */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-[#F6F6F4] border border-slate-200/80 mb-4 text-[11px]">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Standard MOQ
              </span>
              <span className="font-bold text-slate-800 truncate block">
                {product.moq}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Lead Time
              </span>
              <span className="font-bold text-slate-800 truncate block">
                {product.leadTime}
              </span>
            </div>
          </div>
        </div>

        {/* CTA Bar */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onViewDetails(product)
            }}
            className="text-xs font-bold text-slate-700 hover:text-[#051F16] hover:underline flex items-center gap-1 cursor-pointer py-1.5 px-1"
          >
            <span>View Details</span>
            <MaterialIcon name="arrow_forward" size={14} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRequestQuote(product)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white text-xs font-bold shadow-2xs hover:shadow-xs transition-all duration-200 cursor-pointer"
          >
            <span>Request Quote</span>
            <MaterialIcon name="bolt" size={14} className="text-[#A3F65C]" />
          </button>
        </div>
      </div>
    </div>
  )
}
export default ProductCard
