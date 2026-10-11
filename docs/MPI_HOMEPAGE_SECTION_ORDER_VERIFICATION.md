# MPI — Homepage Section Order Verification Audit

**Date:** 2026-10-11  
**Target:** MPI Production Homepage (`src/screens/Home.tsx`, `src/hooks/useHomepageCinematicGSAP.ts`)  
**Scope:** Reordering homepage sections below the Metrics & Trust/Marquee Band to match the exact canonical sequence while preserving 100% of existing content, styling, data, animations, and functionality.  
**Pre-reorder Checkpoint Tag:** `pre-homepage-section-reorder-checkpoint` (Commit `f4b7e1c`)  
**Post-reorder Checkpoint Tag:** `homepage-section-reorder-complete`  

---

## 1. Executive Summary & Verification Matrix

The sections immediately below the Metrics & Credibility Band (`28+ Active Hubs`, `75+ Procure-Ready Offerings`, `7 Core Verticals`, `upto 18-32% Target Cost Reduction`) and the Continuous Dual Industrial Cluster / Statutory Marquees have been sequenced into the exact requested canonical order.

### Section Sequence Comparison Matrix

| # | Requested Canonical Order | Component / Location in `Home.tsx` | Status |
| :--- | :--- | :--- | :--- |
| **—** | **Metrics & Credibility Band** | `<section className="bg-white border-y ...">` (lines 1067-1160) | **Preserved untouched** |
| **—** | **Dual Industrial & Statutory Marquees** | `<section className="py-8 bg-[#FAFAFC] ...">` (lines 1161-1216) | **Preserved untouched** |
| **1** | **The Procurement Bottleneck** | `<section id="solutions" ...>` (`5. CORE VALUE EDITORIAL SECTION`) | **Position 1 (Verified)** |
| **2** | **The Connected Ecosystem** | `<section data-cinematic-section="ecosystem" ...>` (relocated from former position 8) | **Position 2 (Verified)** |
| **3** | **Intelligent Discovery** | Chapter A in `<section id="how-it-works" ...>` (`data-cinematic-section="discovery"`) | **Position 3 (Verified)** |
| **4** | **Transparent Procurement** | Chapter B in `<section id="how-it-works" ...>` (`data-cinematic-section="transparent-procurement"`) | **Position 4 (Verified)** |
| **5** | **Savings Intelligence** | Chapter C/D in `<section id="how-it-works" ...>` (`Commercial Discovery & Value Ledger`) | **Position 5 (Verified)** |
| **6** | **MPI Products and Services Catalogue** | `<ProductCatalogue ... />` (`id="marketplace"`) | **Position 6 (Verified)** |
| **7** | **Workflow Consolidation** | `<section data-cinematic-section="workflow" ...>` (`9. INTEGRATION & WORKFLOW CENTER`) | **Position 7 (Verified)** |
| **8** | **Sourcing Case Scenarios & Benchmarks** | `<section className="py-20 bg-white border-y ...">` (`10. SOURCING CASE SCENARIOS`) | **Position 8 (Verified)** |
| **9** | **Government Schemes Intelligence** | `<section id="government-schemes" ...>` (`11. GOVERNMENT SCHEMES ESTIMATOR`) | **Position 9 (Verified)** |
| **10** | **Frequently Asked Questions** | `<section className="py-20 bg-white border-y ...">` (`12. FAQ SECTION`) | **Position 10 (Verified)** |
| **11** | **Start Your Procurement Journey** | `<section className="py-24 lg:py-32 bg-[#051F16] ...">` (`13. FINAL CALL TO ACTION`) | **Position 11 (Verified)** |
| **—** | **Minimal Clean Footer** | `<footer className="bg-white border-t ...">` (`14. MINIMAL CLEAN FOOTER`) | **Preserved after final CTA** |

---

## 2. Content & Design Integrity

- **Zero Content Rewrites:** All headlines, paragraphs, subtitles, badges, disclosures, and card copy remain 100% identical.
- **Data Protection:** Generic taxonomy (`Standard Batch Run`, `Bulk Volume Option`, `Accelerated Turnaround`) and no confidential supplier credentials or live pricing exposure.
- **Design System Consistency:** Deep forest green (`#051F16`), electric lime (`#A3F65C`), slate card surfaces, `Plus Jakarta Sans`, and `font-editorial italic` styling preserved across all 11 sections.
- **Single-Border Transitions:** Verified that section backgrounds alternate cleanly between `#FAFAFC` and `bg-white` with single border dividers (`border-slate-200/80` and `border-slate-200/90`).

---

## 3. GSAP ScrollTrigger & Animation Revalidation

- **Orchestration Order:** Updated [`src/hooks/useHomepageCinematicGSAP.ts`](file:///Users/haccrr/Downloads/MPI_AI_Procurement_CoFounder_MVP_Complete_Research_Redesign/src/hooks/useHomepageCinematicGSAP.ts) to register cinematic ScrollTrigger timelines in top-to-bottom document order:
  1. `ecosystemSec` (`[data-cinematic-section='ecosystem']`, Section 2)
  2. `discoverySec` (`[data-cinematic-section='discovery']`, Section 3)
  3. `procurementSec` (`[data-cinematic-section='transparent-procurement']`, Section 4)
  4. `workflowSec` (`[data-cinematic-section='workflow']`, Section 7)
- **ScrollTrigger Lifecycle:** Explicitly added `ScrollTrigger.refresh()` after context setup to ensure viewport triggers and scroll start/end offsets are cleanly recalculated for the new layout.
- **Reverse Scrolling:** Independent timeline triggers ensure elements enter smoothly on scroll down and reverse cleanly on scroll up without jump or jitter.

---

## 4. Navigation & Anchor Verification

- `#solutions` scrolls directly to **The Procurement Bottleneck**.
- `#how-it-works` scrolls to the unified storytelling container (**Intelligent Discovery**, **Transparent Procurement**, and **Savings Intelligence**).
- `#marketplace` scrolls directly to **MPI Products and Services Catalogue**.
- `#government-schemes` scrolls directly to **Government Schemes Intelligence**.

---

## 5. Build & Typecheck Confirmation

| Check | Command | Result |
| :--- | :--- | :--- |
| **TypeScript Compilation** | `pnpm exec tsc --noEmit` | **Passed (0 errors)** |
| **Production Vite Build** | `pnpm run build` | **Passed (1.44s)** |
