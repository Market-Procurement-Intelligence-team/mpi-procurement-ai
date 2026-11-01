import type { ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "danger" | "ghost"

const VARIANTS: Record<Variant, string> = {
  // Orange with navy text: white on orange is too faint to read.
  primary: "bg-orange text-navy hover:bg-orange-2",
  secondary: "border-[1.5px] border-navy bg-white text-navy hover:bg-navy-tint",
  danger: "bg-red text-white hover:bg-red-text",
  ghost: "text-navy hover:bg-navy-tint",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  busy?: boolean
}

export default function Button({ variant = "primary", busy = false, className = "", disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
