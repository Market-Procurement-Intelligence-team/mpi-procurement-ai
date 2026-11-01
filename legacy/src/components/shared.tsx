import { ReactNode, useState } from "react"
import { Screen, NavProps } from "../App"

export const MPILogo = ({ small }: { small?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div
      className={`${
        small ? "w-7 h-7 rounded-lg text-xs" : "w-8 h-8 rounded-lg text-sm"
      } bg-[#0F2744] text-white flex items-center justify-center font-bold tracking-tight shadow-xs`}
    >
      <svg
        width={small ? 14 : 16}
        height={small ? 14 : 16}
        viewBox="0 0 20 20"
        fill="none"
      >
        <path
          d="M4 14L7 8L10 11L13 6L16 14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="4" r="1.5" fill="currentColor" />
      </svg>
    </div>
    <div className="flex flex-col">
      <span
        className="font-bold tracking-tight leading-tight text-[#0F172A]"
        style={{
          fontFamily: "Plus Jakarta Sans",
          fontSize: small ? "15px" : "17px",
        }}
      >
        MPI
      </span>
      {!small && (
        <span className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase leading-none">
          Procurement OS
        </span>
      )}
    </div>
  </div>
)

export const VerifiedChip = ({
  label = "MPI Verified",
}: {
  label?: string
}) => (
  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/90 text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-2xs">
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      className="text-emerald-600"
    >
      <path
        d="M10 3L4.5 8.5L2 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    {label}
  </span>
)

export const DemoTag = ({ label = "Demo" }: { label?: string }) => (
  <span
    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200"
    title="Illustrative prototype data"
  >
    {label}
  </span>
)

export const StatusBadge = ({ status }: { status: string }) => {
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
    Matched: {
      bg: "bg-indigo-50",
      text: "text-indigo-700",
      border: "border-indigo-200",
      dot: "bg-indigo-500",
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
    Draft: {
      bg: "bg-slate-50",
      text: "text-slate-600",
      border: "border-slate-200",
      dot: "bg-slate-400",
    },
    Closed: {
      bg: "bg-slate-100",
      text: "text-slate-600",
      border: "border-slate-200",
      dot: "bg-slate-500",
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
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  )
}

export const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors group mb-3 py-1 px-2 -ml-2 rounded-lg hover:bg-slate-100"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-slate-700"
    >
      <path
        d="M10 12L6 8L10 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span>Back</span>
  </button>
)

export const PageHeader = ({
  title,
  subtitle,
  badge,
}: {
  title: string
  subtitle?: string
  badge?: string
}) => (
  <div className="mb-6">
    {badge && (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold mb-2 bg-emerald-50 text-emerald-800 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        {badge}
      </div>
    )}
    <h2
      className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight"
      style={{ fontFamily: "Plus Jakarta Sans" }}
    >
      {title}
    </h2>
    {subtitle && (
      <p className="text-sm text-slate-500 mt-1 max-w-3xl">{subtitle}</p>
    )}
  </div>
)

export const Card = ({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition-all ${className}`}
  >
    {children}
  </div>
)

interface SidebarProps {
  role: "startup" | "msme" | "admin"
  currentScreen: Screen
  navigate: (s: Screen) => void
  onHome: () => void
  onClose?: () => void
}

const startupNav = [
  { screen: "startup.home", label: "Dashboard", icon: HomeIcon },
  { screen: "startup.procurement", label: "New Request", icon: PlusIcon },
  { screen: "startup.ai-assistant", label: "MPI AI Engine", icon: AiIcon },
  { screen: "startup.history", label: "My Requests", icon: ListIcon },
  { screen: "startup.shortlist", label: "Shortlist", icon: StarIcon },
  { screen: "startup.status", label: "Procurement Status", icon: TrackIcon },
  { screen: "startup.profile", label: "Company Profile", icon: UserIcon },
  { screen: "startup.settings", label: "Settings", icon: SettingsIcon },
] as const

const msmeNav = [
  { screen: "msme.home", label: "Dashboard", icon: HomeIcon },
  { screen: "msme.profile", label: "Business Profile", icon: UserIcon },
  { screen: "msme.capabilities", label: "Capabilities", icon: CogIcon },
  { screen: "msme.products", label: "Products & Services", icon: BoxIcon },
  { screen: "msme.certifications", label: "Certifications", icon: BadgeIcon },
  { screen: "msme.verification", label: "Verification", icon: ShieldIcon },
  { screen: "msme.match-readiness", label: "AI Readiness", icon: AiIcon },
  { screen: "msme.opportunities", label: "Opportunities", icon: StarIcon },
  { screen: "msme.analytics", label: "Analytics", icon: ChartIcon },
  { screen: "msme.settings", label: "Settings", icon: SettingsIcon },
] as const

const adminNav = [
  { screen: "admin.home", label: "Dashboard", icon: HomeIcon },
  {
    screen: "admin.user-management",
    label: "User Management",
    icon: UsersIcon,
  },
  { screen: "admin.msme-management", label: "MSME Registry", icon: BoxIcon },
  {
    screen: "admin.verification",
    label: "Verification Queue",
    icon: ShieldIcon,
  },
  { screen: "admin.procurement", label: "Procurement", icon: ListIcon },
  { screen: "admin.ai-matching", label: "MPI AI Activity", icon: AiIcon },
  { screen: "admin.analytics", label: "Ecosystem Analytics", icon: ChartIcon },
  { screen: "admin.reports", label: "Reports", icon: DocIcon },
  { screen: "admin.settings", label: "System Settings", icon: SettingsIcon },
] as const

export function Sidebar({
  role,
  currentScreen,
  navigate,
  onHome,
  onClose,
}: SidebarProps) {
  const navItems =
    role === "startup" ? startupNav : role === "msme" ? msmeNav : adminNav
  const roleLabel =
    role === "startup"
      ? "Startup Workspace"
      : role === "msme"
        ? "MSME Supplier"
        : "Admin Console"

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 hidden md:flex flex-col border-r border-slate-200 bg-white">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <button
          onClick={onHome}
          className="flex items-center gap-2 hover:opacity-85 transition-opacity text-left"
        >
          <MPILogo small />
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
          {role}
        </span>
      </div>

      {/* Nav list */}
      <div className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Navigation
      </div>
      <nav className="flex-1 px-2.5 pb-4 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const active = currentScreen === item.screen
          const Icon = item.icon
          return (
            <button
              key={item.screen}
              onClick={() => {
                navigate(item.screen as Screen)
                if (onClose) onClose()
              }}
              className={`sidebar-item w-full text-left rounded-lg px-3 py-2 transition-all flex items-center gap-2.5 text-xs font-medium ${
                active
                  ? "bg-slate-900 text-white font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={16} active={active} />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Bottom user card */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {role === "startup" ? "TN" : role === "msme" ? "MS" : "AD"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {role === "startup"
                  ? "TechNova Inc."
                  : role === "msme"
                    ? "Apex Precision"
                    : "Admin Operations"}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {roleLabel}
              </div>
            </div>
          </div>
          <button
            onClick={onHome}
            title="Switch Workspace / Exit"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H6M10 11L13 8M13 8L10 5M13 8H5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

export function AppShell({
  children,
  role,
  currentScreen,
  navigate,
  goBack,
  title,
  subtitle,
  showBack = false,
}: {
  children: ReactNode
  role: "startup" | "msme" | "admin"
  currentScreen: Screen
  navigate: NavProps["navigate"]
  goBack: () => void
  title?: string
  subtitle?: string
  showBack?: boolean
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const roleName =
    role === "startup"
      ? "Startup Portal"
      : role === "msme"
        ? "MSME Supplier"
        : "Admin Control"
  const navItems =
    role === "startup" ? startupNav : role === "msme" ? msmeNav : adminNav

  return (
    <div
      className={`mpi-app-shell mpi-role-${role} flex h-screen overflow-hidden bg-slate-50`}
    >
      {/* Desktop Persistent Sidebar */}
      <Sidebar
        role={role}
        currentScreen={currentScreen}
        navigate={navigate}
        onHome={() => navigate("home" as Screen)}
      />

      {/* Mobile Slide-over Drawer for Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-fade-in">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col z-10">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <MPILogo small />
              <button
                onClick={() => setMobileNavOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
              {navItems.map((item) => {
                const active = currentScreen === item.screen
                const Icon = item.icon
                return (
                  <button
                    key={item.screen}
                    onClick={() => {
                      navigate(item.screen as Screen)
                      setMobileNavOpen(false)
                    }}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-all flex items-center gap-3 text-xs font-semibold ${
                      active
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={16} active={active} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => {
                  navigate("home")
                  setMobileNavOpen(false)
                }}
                className="w-full bg-black text-white py-2.5 rounded-full text-xs font-semibold cursor-pointer"
              >
                ← Return to Analytics Bento
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {/* Sleek Top Header Bar (Responsive) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            {/* Hamburger Button on Mobile */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="Open Navigation Menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <button
              onClick={() => navigate("home")}
              className="hover:text-slate-900 font-medium transition-colors"
            >
              MPI
            </button>
            <span>/</span>
            <span className="font-medium text-slate-700 truncate hidden sm:inline">
              {roleName}
            </span>
            <span className="hidden sm:inline">/</span>
            <span className="text-slate-900 font-semibold capitalize truncate">
              {currentScreen.split(".")[1] || "Dashboard"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate("home")}
              className="text-xs font-semibold text-stone-800 hover:text-black px-2.5 sm:px-3 py-1.5 rounded-full border border-stone-200 bg-white hover:bg-stone-50 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>📊</span>
              <span className="hidden sm:inline">Analytics Bento</span>
            </button>
            <button
              onClick={() => navigate("landing")}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Switch Role
            </button>
          </div>
        </header>

        {/* Content Area (Responsive padding) */}
        <div className="max-w-6xl mx-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 md:py-7">
          {showBack && <BackButton onClick={goBack} />}
          {title && <PageHeader title={title} subtitle={subtitle} />}
          {children}
        </div>
      </main>
    </div>
  )
}

// Crisp Vector Icon Components
function HomeIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M3 8.5L10 3L17 8.5V16C17 16.5523 16.5523 17 16 17H12V12H8V17H4C3.44772 17 3 16.5523 3 16V8.5Z"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <path
        d="M10 7V13M7 10H13"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ListIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M4 5H16M4 10H16M4 15H11"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function StarIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.5L12.3 7.2L17.5 7.9L13.7 11.6L14.6 16.8L10 14.3L5.4 16.8L6.3 11.6L2.5 7.9L7.7 7.2L10 2.5Z"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrackIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle
        cx="5"
        cy="10"
        r="2.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <circle
        cx="15"
        cy="10"
        r="2.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <path
        d="M7.5 10H12.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="6"
        r="3.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <path
        d="M3.5 16.5C3.5 13.5 6.5 11.5 10 11.5C13.5 11.5 16.5 13.5 16.5 16.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SettingsIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle
        cx="10"
        cy="10"
        r="3"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <path
        d="M10 2.5V4.5M10 15.5V17.5M2.5 10H4.5M15.5 10H17.5M4.7 4.7L6.1 6.1M13.9 13.9L15.3 15.3M4.7 15.3L6.1 13.9M13.9 6.1L15.3 4.7"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CogIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect
        x="4"
        y="7"
        width="12"
        height="9"
        rx="2"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <path
        d="M7 7V5.5C7 3.8 8.3 2.5 10 2.5C11.7 2.5 13 3.8 13 5.5V7"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BoxIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.5L17 6.5V13.5L10 17.5L3 13.5V6.5L10 2.5Z"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 2.5V17.5M3 6.5L10 10.5L17 6.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BadgeIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2L12.5 6.5L17.5 7.2L13.8 10.8L14.7 15.8L10 13.4L5.3 15.8L6.2 10.8L2.5 7.2L7.5 6.5L10 2Z"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.5L16.5 5V10C16.5 14 13.5 17 10 18C6.5 17 3.5 14 3.5 10V5L10 2.5Z"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10L9 11.5L13 7.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AiIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3L11.8 7.2L16 9L11.8 10.8L10 15L8.2 10.8L4 9L8.2 7.2L10 3Z"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChartIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M3 15L7 10L11 12.5L17 6.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 17H17"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DocIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect
        x="4"
        y="2.5"
        width="12"
        height="15"
        rx="2"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <path
        d="M7 6.5H13M7 10H13M7 13.5H11"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UsersIcon({
  size = 16,
  active = false,
}: {
  size?: number
  active?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle
        cx="8"
        cy="6.5"
        r="3"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
      />
      <circle
        cx="14"
        cy="7.5"
        r="2"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.4"
      />
      <path
        d="M2.5 16.5C2.5 13.5 5 12 8 12C11 12 13.5 13.5 13.5 16.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 12C15.8 12.4 17.5 13.8 17.5 16.5"
        stroke={active ? "#FFFFFF" : "#64748B"}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
