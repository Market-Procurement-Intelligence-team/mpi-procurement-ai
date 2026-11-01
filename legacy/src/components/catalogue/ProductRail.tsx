import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { EnrichedCatalogProduct } from "./catalogue.types"
import ProductCard from "./ProductCard"

interface ProductRailProps {
  products: EnrichedCatalogProduct[]
  currentIndex: number
  onIndexChange: (newIndex: number) => void
  isTransitioningCategory: boolean
  onViewDetails: (product: EnrichedCatalogProduct) => void
  onRequestQuote: (product: EnrichedCatalogProduct) => void
}

export const ProductRail: React.FC<ProductRailProps> = ({
  products,
  currentIndex,
  onIndexChange,
  isTransitioningCategory,
  onViewDetails,
  onRequestQuote,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Drag interaction states
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)

  // Wheel interaction throttling
  const wheelAccumulatorRef = useRef(0)
  const lastWheelTimeRef = useRef(0)

  // Measurements
  const [cardWidth, setCardWidth] = useState(360)
  const cardGap = 20

  // Calculate card width dynamically based on viewport
  useEffect(() => {
    const updateCardMetrics = () => {
      if (typeof window === "undefined") return
      const width = window.innerWidth
      if (width < 640) {
        // Mobile: 84% of viewport width
        setCardWidth(Math.min(340, Math.floor(width * 0.84)))
      } else if (width < 1024) {
        // Tablet: 320px
        setCardWidth(320)
      } else {
        // Desktop: 360px
        setCardWidth(360)
      }
    }

    updateCardMetrics()
    window.addEventListener("resize", updateCardMetrics)
    return () => window.removeEventListener("resize", updateCardMetrics)
  }, [])

  const maxIndex = Math.max(0, products.length - 1)

  // Navigation bounds helper
  const goToIndex = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(index, maxIndex))
      onIndexChange(target)
    },
    [maxIndex, onIndexChange],
  )

  // Keyboard navigation when hovering or focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return
      // Only process when catalogue is within viewport
      const rect = containerRef.current.getBoundingClientRect()
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0
      if (!isVisible) return

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goToIndex(currentIndex - 1)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goToIndex(currentIndex + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, goToIndex])

  // Mouse Wheel translation without scroll trapping
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      // If user is mostly scrolling vertically
      const isVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX)
      if (!isVertical) return

      const now = Date.now()
      const timeDiff = now - lastWheelTimeRef.current

      // Check boundaries to avoid scroll trapping
      const isAtLeftBoundary = currentIndex === 0 && e.deltaY < 0
      const isAtRightBoundary = currentIndex >= maxIndex && e.deltaY > 0

      // If at boundary, let the normal page scroll proceed!
      if (isAtLeftBoundary || isAtRightBoundary) {
        return
      }

      // We are within rail bounds: translate vertical wheel into horizontal card advance
      e.preventDefault()

      wheelAccumulatorRef.current += e.deltaY

      // Once threshold is reached and cooldown passed
      if (timeDiff > 220 && Math.abs(wheelAccumulatorRef.current) > 35) {
        if (wheelAccumulatorRef.current > 0) {
          goToIndex(currentIndex + 1)
        } else {
          goToIndex(currentIndex - 1)
        }
        wheelAccumulatorRef.current = 0
        lastWheelTimeRef.current = now
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [currentIndex, maxIndex, goToIndex])

  // Pointer Drag events (Mouse + Touch unified)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with primary mouse button
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStartX(e.clientX)
    setDragOffset(0)
    // Capture pointer
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const offset = e.clientX - dragStartX
    setDragOffset(offset)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    const offset = e.clientX - dragStartX

    // Snapping logic: threshold is 45px or velocity
    if (offset < -45) {
      // Dragged left -> advance right
      const cardsToSkip = Math.min(3, Math.max(1, Math.round(Math.abs(offset) / cardWidth)))
      goToIndex(currentIndex + cardsToSkip)
    } else if (offset > 45) {
      // Dragged right -> advance left
      const cardsToSkip = Math.min(3, Math.max(1, Math.round(offset / cardWidth)))
      goToIndex(currentIndex - cardsToSkip)
    }

    setDragOffset(0)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerCancel = () => {
    setIsDragging(false)
    setDragOffset(0)
  }

  // Calculate final transform translateX
  const step = cardWidth + cardGap
  const baseTranslateX = -(currentIndex * step)
  const finalTranslateX = baseTranslateX + dragOffset

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden py-4 select-none"
    >
      {/* Horizontal Track Container */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`flex items-stretch gap-5 cursor-grab active:cursor-grabbing will-change-transform ${
          isTransitioningCategory ? "opacity-0 translate-x-12" : "opacity-100 translate-x-0"
        }`}
        style={{
          transform: `translate3d(${finalTranslateX}px, 0, 0)`,
          transition: isDragging
            ? "none"
            : "transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease",
        }}
      >
        {products.map((product, idx) => {
          const isCenter = idx === currentIndex
          const distance = Math.abs(idx - currentIndex)

          // Subtle scale and depth interpolation
          let scale = 1
          let opacity = 1
          if (distance === 1) {
            scale = 0.96
            opacity = 0.92
          } else if (distance >= 2) {
            scale = 0.93
            opacity = 0.78
          }

          return (
            <div
              key={product.id}
              style={{
                width: `${cardWidth}px`,
                transform: `scale(${scale})`,
                opacity,
                transition: isDragging
                  ? "none"
                  : "transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease",
              }}
              className="shrink-0 transition-transform origin-center"
            >
              <ProductCard
                product={product}
                isCenter={isCenter}
                isActive={isCenter}
                onViewDetails={onViewDetails}
                onRequestQuote={onRequestQuote}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default ProductRail
