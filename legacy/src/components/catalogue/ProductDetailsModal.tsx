import React, { useState } from "react"
import { EnrichedCatalogProduct } from "./catalogue.types"
import MaterialIcon from "../ui/MaterialIcon"
import { MPIButton } from "../design-system/MPIDesignSystem"

interface ProductDetailsModalProps {
  product: EnrichedCatalogProduct | null
  onClose: () => void
  onRequestQuote: (product: EnrichedCatalogProduct) => void
  onAskAI?: (product: EnrichedCatalogProduct) => void
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  onClose,
  onRequestQuote,
  onAskAI,
}) => {
  const [imgError, setImgError] = useState(false)

  if (!product) return null

  const imageSrc = imgError ? product.image : product.highResImage || product.image

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Hero Banner */}
        <div className="relative h-48 sm:h-56 bg-slate-100 overflow-hidden shrink-0">
          {imgError ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-slate-400">
              <MaterialIcon name="inventory_2" size={40} className="text-slate-400 mb-1" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {product.category}
              </span>
            </div>
          ) : (
            <img
              src={imageSrc}
              alt={product.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <MaterialIcon name="close" size={18} />
          </button>

          {/* Category Tag & Badge */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
            <span className="text-xs font-bold bg-[#051F16]/90 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
              {product.category}
            </span>
            <span className="text-xs font-semibold bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1">
              <MaterialIcon name="verified" size={14} className="text-emerald-200" />
              Verified Spec Standard
            </span>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h2
                id="modal-title"
                className="text-xl font-extrabold text-[#051F16] tracking-tight"
                style={{ fontFamily: "Plus Jakarta Sans" }}
              >
                {product.name}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* 4-Stat Procurement Matrix */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Standard MOQ
              </span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {product.moq}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Lead Time
              </span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {product.leadTime}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Pricing Guidance
              </span>
              <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                {product.startingPrice}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Government Schemes
              </span>
              <span className="font-bold text-[#D9A400] text-sm mt-0.5 block">
                ZED Subsidy Eligible
              </span>
            </div>
          </div>

          {/* Institutional Specifications */}
          {product.specifications && product.specifications.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Audited Manufacturing & Delivery Standards:
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                {product.specifications.map((spec, i) => (
                  <li key={i} className="flex items-start gap-2 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                    <MaterialIcon name="check_circle" size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-slate-400 italic">
            *Specifications and pricing guidance represent institutional benchmark parameters. Final rates and delivery schedules are confirmed via formal factory RFQ bids.
          </div>

          {/* Modal Footer CTAs */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
            <MPIButton
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Close
            </MPIButton>

            {onAskAI && (
              <MPIButton
                variant="ai"
                size="md"
                className="w-full sm:flex-1"
                onClick={() => {
                  onClose()
                  onAskAI(product)
                }}
                icon={<MaterialIcon name="smart_toy" size={16} className="text-emerald-700" />}
              >
                Refine with AI Co-Founder
              </MPIButton>
            )}

            <MPIButton
              variant="primary"
              size="md"
              className="w-full sm:flex-1"
              onClick={() => {
                onClose()
                onRequestQuote(product)
              }}
              icon={<MaterialIcon name="arrow_forward" size={16} />}
            >
              Request Institutional Quote
            </MPIButton>
          </div>
        </div>
      </div>
    </div>
  )
}
export default ProductDetailsModal
