import { useEffect, useRef } from "react"
import gsap from "gsap"

export interface StartupGSAPOptions {
  animateKPIs?: boolean
  animateHeader?: boolean
  animatePanels?: boolean
}

/**
 * Scoped GSAP animation hook for the MPI Startup Portal.
 * Handles dashboard entrance sequences, KPI reveals, and milestone progress.
 * Respects prefers-reduced-motion and automatically cleans up GSAP contexts on unmount.
 */
export function useStartupGSAP(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: StartupGSAPOptions = { animateKPIs: true, animateHeader: true, animatePanels: true },
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Respect user's motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } })

      // 1. Header entrance
      if (options.animateHeader) {
        const header = el.querySelector("[data-gsap='header']")
        if (header) {
          tl.fromTo(
            header,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.35 }
          )
        }
      }

      // 2. KPI cards staggered entrance
      if (options.animateKPIs) {
        const kpis = el.querySelectorAll("[data-gsap='kpi-card']")
        if (kpis.length > 0) {
          tl.fromTo(
            kpis,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.35, stagger: 0.07 },
            "-=0.2"
          )
        }
      }

      // 3. Main sourcing overview and AI panels entrance
      if (options.animatePanels) {
        const panels = el.querySelectorAll("[data-gsap='panel']")
        if (panels.length > 0) {
          tl.fromTo(
            panels,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 },
            "-=0.15"
          )
        }
      }
    }, el)

    return () => {
      ctx.revert()
    }
  }, [containerRef, options.animateKPIs, options.animateHeader, options.animatePanels, ...deps])
}

/**
 * Scoped GSAP step transition animation for the 7-step Guided Sourcing Builder.
 */
export function useStepTransition(
  stepRef: React.RefObject<HTMLDivElement | null>,
  currentStep: number
) {
  useEffect(() => {
    const el = stepRef.current
    if (!el) return

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReducedMotion) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" }
      )
    }, el)

    return () => {
      ctx.revert()
    }
  }, [stepRef, currentStep])
}
