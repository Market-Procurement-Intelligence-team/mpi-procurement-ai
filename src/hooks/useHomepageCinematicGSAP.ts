import { useEffect, RefObject } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

// Safely register ScrollTrigger once in browser environments
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * useHomepageCinematicGSAP
 * 
 * Cinematic, hardware-accelerated ScrollTrigger orchestration for the 5 target
 * MPI homepage sections:
 * 1. Intelligent Discovery / Natural-Language Intake
 * 2. Supplier Transparency / Review Process
 * 3. Smart Comparison / Comparative Bid Analysis
 * 4. Connected Ecosystem / Manufacturing Grid
 * 5. Workflow Consolidation / 4-Step Journey
 * 
 * Guarantees:
 * - Zero visual redesign: resting state matches pristine static layout exactly.
 * - Accessibility: respects `prefers-reduced-motion` (bypasses motion completely).
 * - Default visibility: content is never hidden if JS, GSAP, or ScrollTrigger fails.
 * - Scoped lifecycle: uses `gsap.context()` with `ctx.revert()` for leak-free cleanup.
 */
export function useHomepageCinematicGSAP(
  containerRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    // 1. Accessibility guard: if user requested reduced motion, leave layout untouched
    if (typeof window === "undefined") return
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const scope = containerRef?.current || document.body

    const ctx = gsap.context(() => {
      const ease = "power2.out"

      // ─── A. Intelligent Discovery ───────────────────────────────────
      const discoverySec = scope.querySelector<HTMLElement>("[data-cinematic-section='discovery']")
      if (discoverySec) {
        const textCol = discoverySec.querySelector("[data-cinematic='discovery-text']")
        const visualCard = discoverySec.querySelector("[data-cinematic='discovery-visual']")
        const inputBox = discoverySec.querySelector("[data-cinematic='discovery-input']")
        const outputBox = discoverySec.querySelector("[data-cinematic='discovery-output']")
        const draftItems = discoverySec.querySelectorAll("[data-cinematic='discovery-item']")

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: discoverySec,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        })

        if (textCol) {
          tl.fromTo(textCol, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease })
        }
        if (visualCard) {
          tl.fromTo(
            visualCard,
            { opacity: 0, y: 32, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.7, ease },
            "-=0.45"
          )
        }
        if (inputBox) {
          tl.fromTo(
            inputBox,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.5, ease },
            "-=0.35"
          )
        }
        if (outputBox) {
          tl.fromTo(
            outputBox,
            { opacity: 0, y: 18, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.55, ease },
            "-=0.25"
          )
        }
        if (draftItems.length > 0) {
          tl.fromTo(
            draftItems,
            { opacity: 0, x: -8 },
            { opacity: 1, x: 0, duration: 0.35, stagger: 0.07, ease },
            "-=0.2"
          )
        }
      }

      // ─── B. Unified Transparent Procurement (Transparency & Comparison) ──────
      const procurementSec = scope.querySelector<HTMLElement>(
        "[data-cinematic-section='transparent-procurement']"
      )
      if (procurementSec) {
        const header = procurementSec.querySelector("[data-cinematic='procurement-header']")
        const panelA = procurementSec.querySelector("[data-cinematic='transparency-panel']")
        const panelB = procurementSec.querySelector("[data-cinematic='comparison-panel']")
        const stageRows = procurementSec.querySelectorAll("[data-cinematic='transparency-stage']")
        const quoteCards = procurementSec.querySelectorAll("[data-cinematic='comparison-card']")
        const disclosures = procurementSec.querySelectorAll("[data-cinematic='procurement-disclosure'], [data-cinematic='transparency-disclosure'], [data-cinematic='comparison-disclosure']")

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: procurementSec,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        })

        if (header) {
          tl.fromTo(header, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease })
        }
        if (panelA && panelB) {
          tl.fromTo(
            [panelA, panelB],
            { opacity: 0, y: 32, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.15, ease },
            "-=0.4"
          )
        } else if (panelA) {
          tl.fromTo(panelA, { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.6, ease }, "-=0.3")
        }
        if (stageRows.length > 0) {
          tl.fromTo(
            stageRows,
            { opacity: 0, y: 12, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.06, ease },
            "-=0.3"
          )
        }
        if (quoteCards.length > 0) {
          tl.fromTo(
            quoteCards,
            { opacity: 0, y: 14, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.08, ease },
            "-=0.35"
          )
        }
        if (disclosures.length > 0) {
          tl.fromTo(
            disclosures,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease },
            "-=0.2"
          )
        }
      }

      // ─── Legacy Standalone Fallback Safeguards ───────────────────────
      const transparencySec = scope.querySelector<HTMLElement>("[data-cinematic-section='transparency']")
      if (transparencySec) {
        const textCol = transparencySec.querySelector("[data-cinematic='transparency-text']")
        const visualCard = transparencySec.querySelector("[data-cinematic='transparency-visual']")
        const stageRows = transparencySec.querySelectorAll("[data-cinematic='transparency-stage']")
        const disclosure = transparencySec.querySelector("[data-cinematic='transparency-disclosure']")

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: transparencySec,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        })

        if (textCol) {
          tl.fromTo(textCol, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease })
        }
        if (visualCard) {
          tl.fromTo(
            visualCard,
            { opacity: 0, y: 32, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.7, ease },
            "-=0.45"
          )
        }
        if (stageRows.length > 0) {
          tl.fromTo(
            stageRows,
            { opacity: 0, y: 16, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.09, ease },
            "-=0.3"
          )
        }
        if (disclosure) {
          tl.fromTo(
            disclosure,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.4, ease },
            "-=0.15"
          )
        }
      }

      const comparisonSec = scope.querySelector<HTMLElement>("[data-cinematic-section='comparison']")
      if (comparisonSec) {
        const textCol = comparisonSec.querySelector("[data-cinematic='comparison-text']")
        const visualCard = comparisonSec.querySelector("[data-cinematic='comparison-visual']")
        const quoteCards = comparisonSec.querySelectorAll("[data-cinematic='comparison-card']")
        const disclosure = comparisonSec.querySelector("[data-cinematic='comparison-disclosure']")

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: comparisonSec,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        })

        if (textCol) {
          tl.fromTo(textCol, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease })
        }
        if (visualCard) {
          tl.fromTo(
            visualCard,
            { opacity: 0, y: 32, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.7, ease },
            "-=0.45"
          )
        }
        if (quoteCards.length > 0) {
          tl.fromTo(
            quoteCards,
            { opacity: 0, y: 20, scale: 0.97 },
            { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.11, ease },
            "-=0.3"
          )
        }
        if (disclosure) {
          tl.fromTo(
            disclosure,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.4, ease },
            "-=0.15"
          )
        }
      }

      // ─── D. Connected Ecosystem ─────────────────────────────────────
      const ecosystemSec = scope.querySelector<HTMLElement>("[data-cinematic-section='ecosystem']")
      if (ecosystemSec) {
        const header = ecosystemSec.querySelector("[data-cinematic='ecosystem-header']")
        const hubNode = ecosystemSec.querySelector("[data-cinematic='ecosystem-hub']")
        const lines = ecosystemSec.querySelector("[data-cinematic='ecosystem-lines']")
        const nodes = ecosystemSec.querySelectorAll("[data-cinematic='ecosystem-node']")

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: ecosystemSec,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        })

        if (header) {
          tl.fromTo(header, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease })
        }
        if (hubNode) {
          tl.fromTo(
            hubNode,
            { opacity: 0, scale: 0.88, y: 16 },
            { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.2)" },
            "-=0.35"
          )
        }
        if (lines) {
          tl.fromTo(lines, { opacity: 0 }, { opacity: 0.35, duration: 0.5, ease: "power1.inOut" }, "-=0.25")
        }
        if (nodes.length > 0) {
          tl.fromTo(
            nodes,
            { opacity: 0, y: 24, scale: 0.96 },
            { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.08, ease },
            "-=0.2"
          )
        }
      }

      // ─── E. Workflow Consolidation ──────────────────────────────────
      const workflowSec = scope.querySelector<HTMLElement>("[data-cinematic-section='workflow']")
      if (workflowSec) {
        const header = workflowSec.querySelector("[data-cinematic='workflow-header']")
        const cards = workflowSec.querySelectorAll("[data-cinematic='workflow-card']")

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: workflowSec,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        })

        if (header) {
          tl.fromTo(header, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.65, ease })
        }
        if (cards.length > 0) {
          tl.fromTo(
            cards,
            { opacity: 0, y: 32, scale: 0.96 },
            { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.12, ease },
            "-=0.35"
          )
        }
      }
    }, scope)

    return () => {
      ctx.revert()
    }
  }, [containerRef])
}

export default useHomepageCinematicGSAP

