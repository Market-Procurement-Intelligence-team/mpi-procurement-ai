import React from "react"
import { Screen } from "../../App"
import { Icons } from "../../components/design-system/MPIDesignSystem"
import { StartupBusinessProfile, OrderItem } from "../../context/ProcurementContext"

interface StartupSidebarProps {
  currentScreen: Screen
  navigate: (screen: Screen) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  startupProfile: StartupBusinessProfile
  ordersList: OrderItem[]
  onOpenHelp: () => void
}

interface NavItem {
  screen: Screen
  label: string
  icon: React.ReactNode
  badge?: string
}

interface NavGroup {
  group: string
  items: NavItem[]
}

export default function StartupSidebar({
  currentScreen,
  navigate,
  sidebarOpen,
  setSidebarOpen,
  startupProfile,
  ordersList,
  onOpenHelp,
}: StartupSidebarProps) {
  // Financial metrics from genuine records
  const totalBudget = startupProfile.annualProcurementBudget || 2000000
  const committedBudget = ordersList.reduce((sum, o) => sum + (o.orderValue || 0), 0)
  const budgetPercentage = Math.min(
    100,
    Math.max(0, Math.round((committedBudget / totalBudget) * 100))
  )
  const availableBudget = Math.max(0, totalBudget - committedBudget)

  // Real company profile from local session or profile state
  const activeUserObj = (() => {
    try {
      const raw = localStorage.getItem("mpi_active_user")
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()
  const displayCompanyName =
    activeUserObj?.orgName ||
    activeUserObj?.companyName ||
    startupProfile.startupName ||
    "TechNova Innovations"
  const isDpiitVetted =
    startupProfile.hasDpiit || Boolean(startupProfile.dpiitNumber)

  // Navigation items strictly mapped to requested groups & existing working routes
  const navGroups: NavGroup[] = [
    {
      group: "WORKSPACE",
      items: [
        {
          screen: "startup.home",
          label: "Overview",
          icon: <Icons.Building className="w-4 h-4" />,
        },
      ],
    },
    {
      group: "SOURCING",
      items: [
        {
          screen: "startup.rfq",
          label: "RFQs",
          icon: <Icons.FileText className="w-4 h-4" />,
        },
        {
          screen: "startup.match-results",
          label: "Suppliers",
          icon: <Icons.Search className="w-4 h-4" />,
        },
        {
          screen: "startup.history",
          label: "Sourcing Events",
          icon: <Icons.FolderCheck className="w-4 h-4" />,
        },
      ],
    },
    {
      group: "INTELLIGENCE",
      items: [
        {
          screen: "startup.ai-assistant",
          label: "Market Insights",
          icon: <Icons.Sparkles className="w-4 h-4" />,
          badge: "AI",
        },
        {
          screen: "startup.comparison",
          label: "Supplier Intelligence",
          icon: <Icons.ShieldCheck className="w-4 h-4" />,
        },
        {
          screen: "startup.analytics",
          label: "Spend Analytics",
          icon: <Icons.BarChart3 className="w-4 h-4" />,
        },
        {
          screen: "startup.schemes",
          label: "Govt Subsidies & Schemes",
          icon: <Icons.Award className="w-4 h-4" />,
          badge: "30 Schemes",
        },
      ],
    },
    {
      group: "ORDERS",
      items: [
        {
          screen: "startup.status",
          label: "Orders",
          icon: <Icons.Clock className="w-4 h-4" />,
        },
        {
          screen: "startup.status",
          label: "Escrow & Payments",
          icon: <Icons.Coins className="w-4 h-4" />,
        },
        {
          screen: "startup.samples",
          label: "Deliveries",
          icon: <Icons.Package className="w-4 h-4" />,
        },
      ],
    },
    {
      group: "SETTINGS",
      items: [
        {
          screen: "startup.settings",
          label: "Settings",
          icon: <Icons.Settings className="w-4 h-4" />,
        },
      ],
    },
  ]

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Persistent Deep Forest Sidebar (~240px Desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 sm:w-64 bg-[#051F16] text-white flex flex-col justify-between transition-transform duration-300 border-r border-[#0A3525] lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          {/* Header & Logo */}
          <div className="p-4 sm:p-5 border-b border-[#0A3525] flex items-center justify-between">
            <button
              onClick={() => navigate("home")}
              className="flex items-center gap-2.5 text-left cursor-pointer group"
              title="Return to MPI Homepage"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0A3525] border border-emerald-800/60 text-[#A3F65C] flex items-center justify-center font-bold shadow-xs transition-transform group-hover:scale-105">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M4 14L8 8L12 12L16 6L20 14" />
                </svg>
              </div>
              <div>
                <div
                  className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5"
                  style={{ fontFamily: "Plus Jakarta Sans" }}
                >
                  <span>MPI</span>
                  <span className="text-[10px] font-bold text-[#A3F65C] bg-[#0A3525] px-1.5 py-0.5 rounded border border-emerald-800/50">
                    B2B
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                  STARTUP WORKSPACE
                </div>
              </div>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A3525] transition-colors"
              aria-label="Close navigation sidebar"
            >
              <Icons.Close className="w-5 h-5" />
            </button>
          </div>

          {/* Signed-in Business Profile Summary */}
          <div className="p-3.5 mx-3 my-3 bg-[#0A3525]/70 rounded-xl border border-emerald-900/50 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-xs font-bold text-white truncate max-w-32.5"
                title={displayCompanyName}
              >
                {displayCompanyName}
              </span>
              <span className="text-[10px] bg-emerald-950 text-[#A3F65C] font-bold px-1.5 py-0.5 rounded border border-emerald-800/60 shrink-0">
                {isDpiitVetted ? "DPIIT Vetted" : "Verified Buyer"}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-medium">
              Budget: ₹{committedBudget.toLocaleString("en-IN")} / ₹
              {totalBudget.toLocaleString("en-IN")}
            </div>
            {/* Real Budget Utilization Progress Bar */}
            <div className="w-full bg-[#051F16] h-1.5 rounded-full mt-2 overflow-hidden border border-emerald-900/40">
              <div
                className="bg-[#A3F65C] h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
              <span>{budgetPercentage}% Committed</span>
              <span className="text-slate-300">
                ₹{availableBudget.toLocaleString("en-IN")} Avail
              </span>
            </div>
          </div>

          {/* Grouped Navigation Links */}
          <nav className="px-3 py-1 space-y-4">
            {navGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {group.group}
                </div>
                {group.items.map((item, idx) => {
                  const isActive = currentScreen === item.screen
                  return (
                    <button
                      key={`${item.screen}-${idx}`}
                      onClick={() => {
                        navigate(item.screen)
                        setSidebarOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                        isActive
                          ? "bg-[#0A3525] text-white border-l-2 border-[#A3F65C] pl-2.5 shadow-xs"
                          : "text-slate-300 hover:bg-[#0A3525]/60 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className={`shrink-0 transition-colors ${
                            isActive
                              ? "text-[#A3F65C]"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#051F16] text-[#A3F65C] border border-emerald-800/60">
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C] shadow-[0_0_8px_#A3F65C]" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}

            {/* Help & Support Button in Settings Group */}
            <div className="pt-0">
              <button
                onClick={() => {
                  onOpenHelp()
                  setSidebarOpen(false)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#0A3525]/60 hover:text-white transition-all cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-slate-200 shrink-0">
                  <Icons.HelpCircle className="w-4 h-4" />
                </span>
                <span className="truncate">Help & Support</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Bottom Identity Card & Public Links */}
        <div className="p-3.5 border-t border-[#0A3525] space-y-2 bg-[#051F16]/95">
          <button
            onClick={() => navigate("home")}
            className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-[#0A3525] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-xs">🏠</span>
              <span>Home Marketplace</span>
            </span>
            <span className="text-[10px] bg-[#0A3525] px-1.5 py-0.5 rounded text-slate-300 border border-emerald-900/50">
              Public
            </span>
          </button>

          <button
            onClick={() => navigate("government-schemes.match")}
            className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded-lg hover:bg-[#0A3525] cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-xs">📜</span>
              <span>Gov Schemes (Grants)</span>
            </span>
            <span className="text-[10px] bg-emerald-950 text-[#A3F65C] border border-emerald-800/50 px-1.5 py-0.5 rounded font-bold">
              Subsidies
            </span>
          </button>

          <div className="pt-1.5 border-t border-[#0A3525]/80 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              MPI Protocol 2.4
            </span>
            <span className="text-[#A3F65C] font-semibold">100% Encrypted</span>
          </div>
        </div>
      </aside>
    </>
  )
}
