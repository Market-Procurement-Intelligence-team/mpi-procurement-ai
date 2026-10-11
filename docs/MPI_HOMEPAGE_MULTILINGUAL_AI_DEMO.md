# MPI — Dynamic 8-Language AI Parser Demo on Homepage

**Document Version:** 1.0.0  
**Implementation Date:** October 11, 2026  
**Auditor/Engineer:** Senior React + TypeScript & Multilingual GSAP Systems Engineer  
**Target Section:** Homepage `Intelligent Discovery` Chapter A (`#solutions`)  
**Component:** `src/components/home/MultilingualAiParserDemo.tsx`  
**Dataset:** `src/data/multilingualAiParserData.ts`  

---

## 1. Executive Summary

The Intelligent Discovery showcase card on the MPI homepage has been transformed from a static mock into an automated, dynamic 8-language rotating demonstration. The demonstration seamlessly showcases MPI's neural intake capability in every language supported by the platform's global translation engine.

The input natural language prompt, the structured request draft, the header badges, status pills, and all five requirement fields transition simultaneously in lockstep, demonstrating that MPI can structure complex engineering and packaging requests in any major Indian language.

---

## 2. Canonical 8 Supported Languages

Derived directly from `SUPPORTED_LANGUAGES` in `src/lib/languageTranslator.ts`:

| # | Code | Language Name | Native Script Name | Verification Status |
|:-:|:---:|:---|:---|:---:|
| 1 | `en` | English | English | Canonical Source |
| 2 | `hi` | Hindi | हिन्दी (Hindi) | Verified Native Phrasing |
| 3 | `ta` | Tamil | தமிழ் (Tamil) | Verified Native Phrasing |
| 4 | `te` | Telugu | తెలుగు (Telugu) | Verified Native Phrasing |
| 5 | `mr` | Marathi | मराठी (Marathi) | Verified Native Phrasing |
| 6 | `bn` | Bengali | বাংলা (Bengali) | Verified Native Phrasing |
| 7 | `gu` | Gujarati | ગુજરાતી (Gujarati) | Verified Native Phrasing |
| 8 | `kn` | Kannada | ಕನ್ನಡ (Kannada) | Verified Native Phrasing |

---

## 3. Translation Architecture & Semantic Consistency

Every language provides full semantic parity with the canonical English requirement:

> *"We need custom packaging for an upcoming product launch, with a premium finish, a protective insert, and a specific delivery deadline."*

### Field Mapping in Output Draft:
1. **Product requirements:** Custom rigid packaging box
2. **Quantity and specifications:** 500 units target batch
3. **Materials and customization:** Premium finish, protective insert
4. **Delivery requirements:** Specified launch deadline
5. **Missing details to confirm:** Exact dimensions, print artwork files

### Status Labels Localized:
- **Input Badge:** `INPUT: Raw Natural Language Prompt` -> localized per language
- **Parser Status:** `● AI PARSER READY` -> localized per language
- **Output Badge:** `STRUCTURED REQUEST DRAFT` -> localized per language
- **Draft Status:** `Draft Preview • Not Dispatched` -> localized per language

---

## 4. Animation & Lifecycle Mechanics

1. **Rotation Timing:**
   - Sequential advance every 4,000ms (~4 seconds).
   - Loops seamlessly from Language 8 (`kn`) back to Language 1 (`en`).
2. **Transitions:**
   - 220ms subtle vertical slide-out (`translate-y-1.5`) and fade (`opacity-0`).
   - Content swap executes in lockstep.
   - 200ms slide-in (`translate-y-0`) and fade-in (`opacity-100`).
3. **User Interaction & Pause:**
   - **Hover / Focus:** Hovering with mouse or focusing with keyboard pauses rotation so visitors can read longer requirements comfortably.
   - **Manual Navigation:** Visitors can click any of the 8 language dots at the bottom of the card to inspect a specific language immediately.
4. **Resource Optimization:**
   - **IntersectionObserver:** Pauses timer when card is scrolled out of viewport.
   - **Page Visibility API:** Pauses timer when browser tab is inactive (`document.hidden`).
5. **Accessibility (`prefers-reduced-motion`):**
   - Automatically detects user motion preferences.
   - When reduced motion is preferred, transitions skip opacity/slide animations and update instantly with 0ms duration.
6. **GSAP ScrollTrigger Compatibility:**
   - Preserves all canonical `data-cinematic` attributes (`discovery-visual`, `discovery-input`, `discovery-output`, `discovery-item`) so `useHomepageCinematicGSAP` continues to trigger the initial entrance animation without collision.

---

## 5. Layout Stability & Zero-Shift Architecture

To prevent layout jumping across languages with varying text lengths and scripts:
- **Input Box:** Constrained with `min-h-[88px] sm:min-h-[80px]` and flex alignment.
- **Output Box:** Constrained with `min-h-[292px] sm:min-h-[268px]` flex column layout.
- Container padding, borders, shadows, and fonts remain identical to the approved design.

---

## 6. Build and Verification Results

- **TypeScript Compilation (`tsc --noEmit`):**
  - Exit Code: `0` (Zero errors).
- **Vite Production Build (`pnpm run build`):**
  - Exit Code: `0`.
  - Transformed 2,593 modules in 1.09s.
  - Assets generated: `dist/assets/index-CK8eYPWL.js` (2,396 kB).

---

## 7. Modified Files

1. `src/data/multilingualAiParserData.ts` (New typed 8-language procurement intake dataset).
2. `src/components/home/MultilingualAiParserDemo.tsx` (New animated React component).
3. `src/screens/Home.tsx` (Integrated component into Intelligent Discovery section).
