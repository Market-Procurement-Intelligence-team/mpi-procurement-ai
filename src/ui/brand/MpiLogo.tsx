/**
 * The MPI logo, animated (colour cycle with rising bars), always on the dark
 * background it was designed for. It loads after the page, so screens don't
 * wait for it: until then, and for people who turn off motion, the static
 * dark logo shows in the same spot.
 * `wordmark={false}` shows the swirl only, without the words underneath.
 *
 * The animation itself lives in ./mpi-emblem (from rivanah's "logo 2" project).
 */

import { lazy, Suspense, type CSSProperties } from "react"
import staticLogo from "../../assets/brand/mpi-logo-dark.webp"
import staticSwirl from "../../assets/brand/mpi-swirl-dark.webp"

const MpiEmblemAnimation = lazy(() => import("./mpi-emblem/MpiEmblemAnimation"))

const LABEL = "MPI, Market Procurement Intelligence, since 2026"

export default function MpiLogo({ className = "", wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <div className={className} style={{ "--mpi-emblem-bg": "transparent" } as CSSProperties}>
      <Suspense
        fallback={
          <img
            src={wordmark ? staticLogo : staticSwirl}
            alt={LABEL}
            className={`block w-full object-contain ${wordmark ? "aspect-[851/1094]" : "aspect-[851/760]"}`}
          />
        }
      >
        <MpiEmblemAnimation label={LABEL} wordmark={wordmark} />
      </Suspense>
    </div>
  )
}
