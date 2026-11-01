import type { HTMLAttributes } from "react"

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the thin brand gradient line on top, for key cards. */
  accent?: boolean
}

export default function Card({ accent = false, className = "", children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`overflow-hidden rounded-lg border-[1.5px] border-line bg-white shadow-[0_1px_3px_rgba(21,35,61,0.08)] ${className}`}
    >
      {accent && <div className="accent-line h-1" />}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}
