// Types for the animated logo component (MpiEmblemAnimation.jsx).
import type { JSX } from "react"

export interface MpiEmblemAnimationProps {
  className?: string
  /** Seconds per full colour cycle (default 7.2). */
  duration?: number
  label?: string
  /** false shows the animated swirl only, without the words underneath. */
  wordmark?: boolean
}

export default function MpiEmblemAnimation(props: MpiEmblemAnimationProps): JSX.Element
