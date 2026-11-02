import { useState, useRef, useCallback, MouseEvent } from "react"

/**
 * useParallaxTilt: Zero-dependency 3D cursor-tracking tilt interaction.
 * Gives cards and hero elements an organic, tactile depth response on hover.
 */
export function useParallaxTilt<T extends HTMLElement = HTMLDivElement>(maxTiltDeg = 6) {
  const ref = useRef<T>(null)
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)")
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback(
    (e: MouseEvent<T>) => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const rotateX = ((y - centerY) / centerY) * -maxTiltDeg
      const rotateY = ((x - centerX) / centerX) * maxTiltDeg

      setTransform(
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`
      )
    },
    [maxTiltDeg]
  )

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)")
  }, [])

  return {
    ref,
    tiltProps: {
      ref,
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      style: {
        transform,
        transition: isHovered ? "transform 0.1s ease-out" : "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        transformStyle: "preserve-3d" as const,
        willChange: "transform",
      },
    },
    isHovered,
  }
}

export default useParallaxTilt
