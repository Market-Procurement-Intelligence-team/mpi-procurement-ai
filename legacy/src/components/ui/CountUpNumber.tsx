import React, { useEffect, useRef, useState } from "react"

export interface CountUpProps {
  start?: number
  end?: number | null
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  animate?: boolean
  isLoading?: boolean
  error?: boolean | string
  fallbackText?: string
}

export const CountUpNumber: React.FC<CountUpProps> = ({
  start,
  end,
  duration = 1400,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
  animate,
  isLoading = false,
  error = false,
  fallbackText = "—",
}) => {
  // If end is null/undefined or an error occurred, render fallback
  const isUnavailable = Boolean(error) || end === null || end === undefined

  // Decide whether counting animation is intentional:
  // - If animate is explicitly true
  // - Or if a specific start value was provided (e.g. start={18} end={32})
  const shouldAnimate = !isUnavailable && !isLoading && (animate === true || start !== undefined)

  // Initialize value: if intentional animation is active, start from `start ?? 0`.
  // Otherwise, render `end ?? 0` immediately to eliminate initial-zero flash
  const initialValue = shouldAnimate ? (start ?? 0) : (end ?? 0)
  const [value, setValue] = useState<number>(initialValue)
  const ref = useRef<HTMLSpanElement | null>(null)
  const hasAnimated = useRef(false)
  const prevEndRef = useRef<number | null | undefined>(end)

  // Handle immediate updates when end changes and animation is not active
  useEffect(() => {
    if (isUnavailable || isLoading) return

    // Respect prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      setValue(end ?? 0)
      return
    }

    if (!shouldAnimate) {
      setValue(end ?? 0)
      return
    }

    // If transition from previous known value to new value occurred
    if (
      prevEndRef.current !== undefined &&
      prevEndRef.current !== null &&
      prevEndRef.current !== end
    ) {
      const fromVal = typeof value === "number" ? value : (prevEndRef.current ?? 0)
      const toVal = end ?? 0
      prevEndRef.current = end

      let startTime: number | null = null
      let animationFrameId: number

      const tick = (now: number) => {
        if (!startTime) startTime = now
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        const current = fromVal + (toVal - fromVal) * eased
        setValue(current)

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(tick)
        } else {
          setValue(toVal)
        }
      }

      animationFrameId = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(animationFrameId)
    }

    prevEndRef.current = end
  }, [end, shouldAnimate, isUnavailable, isLoading, duration, value])

  // Viewport intersection observer for scroll-driven intentional animation
  useEffect(() => {
    if (!shouldAnimate || isUnavailable || isLoading) return
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      setValue(end ?? 0)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const startTime = performance.now()
          const fromVal = start ?? 0
          const toVal = end ?? 0

          const tick = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            const current = fromVal + (toVal - fromVal) * eased
            setValue(current)

            if (progress < 1) {
              requestAnimationFrame(tick)
            } else {
              setValue(toVal)
            }
          }

          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [shouldAnimate, start, end, duration, isUnavailable, isLoading])

  // Loading skeleton state
  if (isLoading) {
    return (
      <span
        ref={ref}
        role="status"
        aria-label="Loading metric"
        className={`inline-block animate-pulse bg-slate-200/80 rounded px-1 min-w-[2ch] ${className}`}
      >
        <span className="opacity-0">
          {prefix || ""}
          {end ?? "00"}
          {suffix || ""}
        </span>
      </span>
    )
  }

  // Unavailable / error state
  if (isUnavailable) {
    return (
      <span ref={ref} className={`tabular-nums text-slate-400 ${className}`}>
        {fallbackText}
      </span>
    )
  }

  // Confirmed zero state or normal state
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

export default CountUpNumber

