import { ReactNode } from "react"

// ============================================================================
// MPI ICONS (Crisp, High-Precision SVG Outline Icons - No Random Emojis)
// ============================================================================
export const Icons = {
  Sparkles: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
    </svg>
  ),
  ShieldCheck: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Search: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Filter: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  ArrowRight: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  ),
  ArrowLeft: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  ),
  Check: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Close: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  FileText: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
    </svg>
  ),
  Building: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  ),
  Package: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  ),
  TrendingUp: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Coins: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  ),
  LogOut: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Award: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  ),
  Clock: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  AlertCircle: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  ),
  Download: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  Refresh: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  ),
  Bell: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  MessageSquare: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Settings: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Users: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  BarChart3: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </svg>
  ),
  Menu: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  ),
  HelpCircle: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  ),
  ExternalLink: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  ),
  ChevronRight: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  SlidersHorizontal: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
    </svg>
  ),
  CheckCircle2: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  FolderCheck: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  ),
}

// ============================================================================
// BUTTONS
// ============================================================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ai" | "outline" | "ghost" | "danger" | "savings"
  size?: "sm" | "md" | "lg"
  icon?: ReactNode
  iconRight?: ReactNode
  children: ReactNode
  fullWidth?: boolean
  isLoading?: boolean
}

export function MPIButton({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  children,
  fullWidth = false,
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: "text-xs px-3.5 py-1.5 rounded-full gap-1.5 min-h-[34px]",
    md: "text-sm px-5 py-2.5 rounded-full gap-2 min-h-[40px] leading-none",
    lg: "text-base px-6 py-3 rounded-full gap-2.5 min-h-[44px] leading-none",
  }

  const variantClasses = {
    primary:
      "bg-[#051F16] text-white hover:bg-[#083A28] active:bg-[#051F16] border border-[#0A3525] shadow-xs active:scale-[0.98]",
    secondary:
      "bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30 active:scale-[0.98] backdrop-blur-xs",
    ai: "bg-[#051F16] text-[#A3F65C] hover:bg-[#083A28] active:bg-[#051F16] border border-emerald-900/60 shadow-xs active:scale-[0.98]",
    outline:
      "bg-white text-[#051F16] border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-full active:scale-[0.98]",
    danger: "bg-[#D92D20] text-white hover:bg-red-700 shadow-none active:scale-[0.98]",
    savings: "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/70 shadow-none active:scale-[0.98]",
  }

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
        fullWidth ? "w-full" : ""
      } ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
      {iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  )
}

// ============================================================================
// BADGES & STATUS INDICATORS
// ============================================================================
export function MPIVerifiedBadge({
  label,
  text = "MPI Verified",
}: {
  label?: string
  text?: string
}) {
  const display = label || text
  return (
    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-[#168A5B] border border-emerald-200/90 text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
      <Icons.ShieldCheck className="w-3.5 h-3.5 text-[#168A5B]" />
      <span>{display}</span>
    </span>
  )
}

export function MPISavingsBadge({
  amount,
  label,
}: {
  amount: string
  label?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#FFF7D6] text-[#8C6B00] border border-[#FFE799] text-xs font-bold px-2.5 py-0.5 rounded-full">
      <Icons.TrendingUp className="w-3.5 h-3.5 text-[#D9A400]" />
      <span>Save {amount}</span>
      {label && <span className="text-[#A37D00] font-normal">({label})</span>}
    </span>
  )
}

export function MPIStatusBadge({ status }: { status: string }) {
  const map: Record<string, {
    bg: string
    text: string
    border: string
    dot: string
  }> = {
    Active: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
    },
    Approved: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
    },
    Verified: {
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
      dot: "bg-emerald-600",
    },
    "Admin Verified": {
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-300",
      dot: "bg-emerald-600",
    },
    "Self-Declared": {
      bg: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-300",
      dot: "bg-slate-400",
    },
    Matched: {
      bg: "bg-emerald-100/60",
      text: "text-[#051F16]",
      border: "border-emerald-300",
      dot: "bg-[#051F16]",
    },
    Quoted: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
      dot: "bg-amber-500",
    },
    Submitted: {
      bg: "bg-sky-50",
      text: "text-sky-700",
      border: "border-sky-200",
      dot: "bg-sky-500",
    },
    Pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500",
    },
    "Under Review": {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500",
    },
    Closed: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
      dot: "bg-slate-400",
    },
    Rejected: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      dot: "bg-rose-500",
    },
  }

  const s = map[status] || {
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span>{status}</span>
    </span>
  )
}

// ============================================================================
// CARDS & SURFACES
// ============================================================================
export function MPICard({
  children,
  className = "",
  highlight = false,
  savings = false,
  hover = false,
}: {
  children: ReactNode
  className?: string
  highlight?: boolean
  savings?: boolean
  hover?: boolean
}) {
  let styleClass = "bg-white border border-slate-200/90 shadow-2xs"
  if (highlight)
    styleClass =
      "bg-white border-2 border-[#051F16] shadow-md ring-2 ring-emerald-100"
  if (savings)
    styleClass =
      "bg-emerald-50/40 border border-emerald-200/80 shadow-xs"
  if (hover)
    styleClass +=
      " hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300"

  return (
    <div
      className={`rounded-2xl p-5 md:p-6 transition-all duration-300 ${styleClass} ${className}`}
    >
      {children}
    </div>
  )
}

export function MPIStatCard({
  title,
  value,
  subtitle,
  change,
  trend = "up",
  icon,
  badge,
  onClick,
}: {
  title: string
  value: string | number
  subtitle?: string
  change?: string
  trend?: "up" | "down" | "neutral"
  icon?: ReactNode
  badge?: ReactNode
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-0.5 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">
          {title}
        </span>
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-emerald-50 text-slate-500 group-hover:text-[#051F16] flex items-center justify-center transition-colors">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div
          className="text-2xl md:text-3xl font-extrabold text-[#051F16] tracking-tight"
          style={{ fontFamily: "Plus Jakarta Sans" }}
        >
          {value}
        </div>
        {badge && <div>{badge}</div>}
      </div>
      {(subtitle || change) && (
        <div className="flex items-center gap-2 mt-2.5 text-xs">
          {change && (
            <span
              className={`font-semibold text-[11px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                trend === "up"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                  : trend === "down"
                    ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "•"} {change}
            </span>
          )}
          {subtitle && (
            <span className="text-slate-500 text-[11px] truncate font-medium">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// STEPPERS & TIMELINES
// ============================================================================
export function MPIStepper({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: string[]
  currentStep: number
  onStepClick?: (stepIndex: number) => void
}) {
  return (
    <div className="w-full py-3 overflow-x-auto no-scrollbar">
      <div className="flex items-center justify-between min-w-140 relative">
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 z-0" />
        {steps.map((label, idx) => {
          const isDone = idx < currentStep
          const isCurrent = idx === currentStep

          return (
            <div
              key={label}
              onClick={() => onStepClick && onStepClick(idx)}
              className={`flex flex-col items-center gap-2 relative z-10 transition-all ${
                onStepClick ? "cursor-pointer" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                  isDone
                    ? "bg-emerald-700 text-white"
                    : isCurrent
                      ? "bg-[#051F16] text-white ring-4 ring-emerald-100"
                      : "bg-white border-2 border-slate-300 text-slate-500"
                }`}
              >
                {isDone ? (
                  <Icons.Check className="w-4 h-4 text-white" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-xs font-medium max-w-[90px] text-center ${
                  isCurrent
                    ? "text-[#051F16] font-bold"
                    : isDone
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// EMPTY STATES
// ============================================================================
export function MPIEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}) {
  return (
    <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 md:p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4 shadow-2xs">
        {icon || <Icons.FileText className="w-7 h-7" />}
      </div>
      <h3 className="text-lg font-bold text-[#0B1220] mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 max-w-md">
        {description}
      </p>
      {actionLabel && onAction && (
        <MPIButton variant="primary" onClick={onAction}>
          {actionLabel}
        </MPIButton>
      )}
    </div>
  )
}
