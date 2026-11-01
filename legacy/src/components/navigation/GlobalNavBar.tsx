import React, { useState, useEffect } from "react"
import { Screen, NavProps } from "../../App"
import { MPILogo } from "../shared"
import { Icons } from "../design-system/MPIDesignSystem"
import LanguageTranslatorButton from "./LanguageTranslatorButton"
import MaterialIcon from "../ui/MaterialIcon"
import AuthModal, { AuthPortalContext } from "../auth/AuthModal"
import { RoleKey } from "../../lib/mockAuth"

export interface BreadcrumbCrumb {
  label: string
  screen?: Screen
  isActive?: boolean
}

/**
 * Resolves human-readable breadcrumb segments for any screen in the MPI application.
 */
export function getScreenBreadcrumbs(screen: Screen): BreadcrumbCrumb[] {
  const crumbs: BreadcrumbCrumb[] = [{ label: "Home", screen: "home" }]

  if (screen === "home" || screen === "landing") {
    return [{ label: "Home", screen: "home", isActive: true }]
  }

  // Startup Hub Pages
  if (screen.startsWith("startup.")) {
    crumbs.push({ label: "Startup Hub", screen: "startup.home" })
    const startupTitles: Record<string, string> = {
      "startup.home": "Overview Dashboard",
      "startup.procurement": "New Procurement Intake",
      "startup.ai-assistant": "AI Sourcing Copilot",
      "startup.ai-analysis": "AI Specification Extraction",
      "startup.match-results": "Matched Suppliers",
      "startup.supplier-detail": "Supplier Profile & Vetting",
      "startup.comparison": "Quote Comparison Matrix",
      "startup.shortlist": "Shortlisted Vendors",
      "startup.rfq": "RFQ Generator & Readiness",
      "startup.samples": "Sample Batch Orders",
      "startup.sample-new": "Request Prototype Sample",
      "startup.schemes": "Government Schemes",
      "startup.status": "Production Tracking & Escrow",
      "startup.history": "Sourcing History",
      "startup.profile": "Company Profile",
      "startup.settings": "Account Settings",
      "startup.analytics": "Analytics Studio",
    }
    const subTitle = startupTitles[screen]
    if (subTitle && screen !== "startup.home") {
      crumbs.push({ label: subTitle, screen, isActive: true })
    } else if (screen === "startup.home") {
      crumbs[1].isActive = true
    }
    return crumbs
  }

  // MSME Portal Pages
  if (screen.startsWith("msme.")) {
    crumbs.push({ label: "MSME Portal", screen: "msme.home" })
    const msmeTitles: Record<string, string> = {
      "msme.home": "Supplier Dashboard",
      "msme.profile": "Business Profile",
      "msme.capabilities": "Machinery & Capabilities",
      "msme.products": "Product Catalog",
      "msme.certifications": "ISO & Quality Certifications",
      "msme.verification": "MPI Trust Verification",
      "msme.verification-status": "Audit Status",
      "msme.match-readiness": "RFQ Match Readiness",
      "msme.opportunities": "Live Opportunities",
      "msme.opportunity-detail": "Opportunity Details",
      "msme.proposal": "Submit Commercial Proposal",
      "msme.procurement-status": "Active Orders & Escrow",
      "msme.schemes": "Subsidies & Grants",
      "msme.analytics": "Supplier Analytics",
      "msme.settings": "Settings",
    }
    const subTitle = msmeTitles[screen]
    if (subTitle && screen !== "msme.home") {
      crumbs.push({ label: subTitle, screen, isActive: true })
    } else if (screen === "msme.home") {
      crumbs[1].isActive = true
    }
    return crumbs
  }

  // Admin Portal Pages
  if (screen.startsWith("admin.")) {
    crumbs.push({ label: "Admin Portal", screen: "admin.home" })
    const adminTitles: Record<string, string> = {
      "admin.home": "Control Center",
      "admin.user-management": "User Directory",
      "admin.startup-management": "Startups Directory",
      "admin.msme-management": "Verified MSMEs Directory",
      "admin.verification": "Statutory Audit Queue",
      "admin.procurement": "Escrow Transactions",
      "admin.ai-matching": "AI Telemetry & Calibration",
      "admin.analytics": "Analytics Studio",
      "admin.reports": "Audit Reports",
      "admin.settings": "Security Settings",
    }
    const subTitle = adminTitles[screen]
    if (subTitle && screen !== "admin.home") {
      crumbs.push({ label: subTitle, screen, isActive: true })
    } else if (screen === "admin.home") {
      crumbs[1].isActive = true
    }
    return crumbs
  }

  // Government Schemes Pages
  if (screen.startsWith("government-schemes.")) {
    crumbs.push({ label: "Government Schemes", screen: "government-schemes.match" })
    const schemeTitles: Record<string, string> = {
      "government-schemes.match": "Eligibility Matcher",
      "government-schemes.browse": "Compendium of Schemes",
      "government-schemes.detail": "Scheme Details",
    }
    const subTitle = schemeTitles[screen]
    if (subTitle && screen !== "government-schemes.match") {
      crumbs.push({ label: subTitle, screen, isActive: true })
    } else if (screen === "government-schemes.match") {
      crumbs[1].isActive = true
    }
    return crumbs
  }

  // Analytics Detail Pages
  if (screen.startsWith("analytics.")) {
    crumbs.push({ label: "Analytics Studio", screen: "analytics.detail.ai-insights" })
    const analyticsTitles: Record<string, string> = {
      "analytics.detail.ai-insights": "AI Growth Insights",
      "analytics.detail.total-sales": "Total Sales Deep Dive",
      "analytics.detail.revenue-comparison": "Revenue vs Target",
      "analytics.detail.sales-trend": "Quarterly Trend Analysis",
      "analytics.detail.age-range": "Customer Demographics",
      "analytics.add-widget": "Add Widget Studio",
      "analytics.create-report": "Executive Report Generator",
      "analytics.pulse": "Live Procurement Pulse",
      "analytics.data": "Data Catalog & Exports",
      "analytics.shared": "Team Sharing & Workspaces",
      "analytics.notifications": "Activity Notifications",
      "analytics.messages": "Sourcing Messages",
      "analytics.documents": "Contracts & Escrow Vault",
      "analytics.support": "Help & Support Desk",
      "analytics.profile": "Account Profile",
    }
    const subTitle = analyticsTitles[screen]
    if (subTitle) {
      crumbs.push({ label: subTitle, screen, isActive: true })
    }
    return crumbs
  }

  // Authentication & Onboarding
  if (screen === "login.startup" || screen === "register.startup") {
    crumbs.push({ label: "Startup Login", screen, isActive: true })
    return crumbs
  }
  if (screen === "login.msme" || screen === "register.msme") {
    crumbs.push({ label: "MSME Login", screen, isActive: true })
    return crumbs
  }
  if (screen === "login.admin") {
    crumbs.push({ label: "Admin Login", screen, isActive: true })
    return crumbs
  }
  if (screen === "startup.onboarding") {
    crumbs.push({ label: "Startup Onboarding", screen, isActive: true })
    return crumbs
  }
  if (screen === "msme.onboarding") {
    crumbs.push({ label: "MSME Onboarding", screen, isActive: true })
    return crumbs
  }

  crumbs.push({ label: screen, screen, isActive: true })
  return crumbs
}

export interface AuthRequestOptions {
  mode?: "login" | "signin"
  defaultRole?: RoleKey
  targetScreen?: Screen
  portalContext?: AuthPortalContext
}

export interface GlobalNavBarProps extends NavProps {
  variant?: "light" | "navy" | "subtle"
  showQuickLinks?: boolean
  customBackLabel?: string
  className?: string
  onOpenAuth?: (options?: AuthRequestOptions) => void
}

export default function GlobalNavBar({
  navigate,
  goBack,
  currentScreen,
  variant = "light",
  showQuickLinks = true,
  customBackLabel,
  className = "",
  onOpenAuth,
}: GlobalNavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [internalAuthModal, setInternalAuthModal] = useState<{
    open: boolean
    mode: "login" | "signin"
    defaultRole: RoleKey
    targetScreen?: Screen
    portalContext?: AuthPortalContext
  }>({
    open: false,
    mode: "login",
    defaultRole: "startup",
  })

  const crumbs = getScreenBreadcrumbs(currentScreen)
  const isHomeScreen = currentScreen === "home" || currentScreen === "landing"

  const handleRequestAuth = (options?: AuthRequestOptions) => {
    if (onOpenAuth) {
      onOpenAuth(options)
    } else {
      setInternalAuthModal({
        open: true,
        mode: options?.mode || "login",
        defaultRole: options?.defaultRole || "startup",
        targetScreen: options?.targetScreen,
        portalContext: options?.portalContext,
      })
    }
    setMobileMenuOpen(false)
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Quick navigation items for core platforms (respecting role privacy between Startup & MSME)
  const navHubs: { label: string; screen: Screen; iconName: string; badge?: string }[] = [
    { label: "Home", screen: "home", iconName: "home" },
    ...(currentScreen.startsWith("msme.") ? [] : [{ label: "Startup Hub", screen: "startup.home" as Screen, iconName: "rocket_launch", badge: "Buyers" }]),
    ...(currentScreen.startsWith("startup.") ? [] : [{ label: "MSME Portal", screen: "msme.home" as Screen, iconName: "precision_manufacturing", badge: "Suppliers" }]),
    { label: "Govt Schemes", screen: "government-schemes.match", iconName: "policy", badge: "Subsidies" },
    { label: "Analytics Studio", screen: "analytics.detail.ai-insights", iconName: "insights" },
    { label: "Admin Portal", screen: "admin.home", iconName: "admin_panel_settings" },
  ]

  const isCurrentHub = (screen: Screen) => {
    if (screen === "home" && isHomeScreen) return true
    if (screen === "startup.home" && currentScreen.startsWith("startup.")) return true
    if (screen === "msme.home" && currentScreen.startsWith("msme.")) return true
    if (screen === "government-schemes.match" && currentScreen.startsWith("government-schemes.")) return true
    if (screen === "analytics.detail.ai-insights" && currentScreen.startsWith("analytics.")) return true
    if (screen === "admin.home" && (currentScreen.startsWith("admin.") || currentScreen === "login.admin")) return true
    return false
  }

  // Dynamic back label based on where user is
  const backLabel = customBackLabel || (crumbs.length > 2 ? `Back to ${crumbs[crumbs.length - 2].label}` : "Back")

  return (
    <nav
      aria-label="Universal Site Navigation"
      className={`sticky top-0 w-full z-40 transition-all duration-300 border-b select-none ${
        variant === "navy"
          ? isScrolled
            ? "bg-[#051F16]/95 backdrop-blur-xl text-white border-[#0A3525] shadow-[0_12px_36px_-6px_rgba(5,31,22,0.4)]"
            : "bg-[#051F16] text-white border-transparent"
          : isScrolled
          ? "bg-white/92 backdrop-blur-xl text-slate-800 border-slate-200/90 shadow-[0_10px_30px_-10px_rgba(5,31,22,0.08)]"
          : "bg-white/80 backdrop-blur-md text-slate-800 border-slate-200/50"
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between transition-all duration-300 gap-2 sm:gap-4 ${
            isScrolled ? "h-14 sm:h-15" : "h-16 sm:h-18"
          }`}
        >
          {/* Left section: Logo + Back button + Breadcrumb Trail */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            {/* Logo */}
            <button
              onClick={() => navigate("home")}
              className="flex items-center gap-2 shrink-0 hover:opacity-85 transition-opacity cursor-pointer text-left"
              title="Return to MPI Home"
            >
              <MPILogo small />
            </button>

            {/* Separator */}
            <div
              className={`h-5 w-px shrink-0 hidden sm:block ${
                variant === "navy" ? "bg-[#0A3525]" : "bg-slate-200"
              }`}
            />

            {/* Prominent Back Button (if not on root home) */}
            {!isHomeScreen && (
              <button
                onClick={goBack}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                  variant === "navy"
                    ? "bg-[#083A28]/80 hover:bg-[#083A28] text-slate-200 hover:text-white border-emerald-900/40"
                    : "bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border-slate-200 shadow-2xs hover:-translate-y-0.5"
                }`}
                title="Go to previous page"
              >
                <Icons.ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{backLabel}</span>
                <span className="md:hidden">Back</span>
              </button>
            )}

            {/* Interactive Clickable Breadcrumbs (in Sub-portals) */}
            {!isHomeScreen ? (
              <div className="flex items-center gap-1 text-xs overflow-x-auto no-scrollbar py-1">
                {crumbs.map((crumb, idx) => {
                  const isLast = idx === crumbs.length - 1
                  return (
                    <React.Fragment key={idx}>
                      {idx > 0 && (
                        <span
                          className={`text-[10px] shrink-0 ${
                            variant === "navy" ? "text-slate-400" : "text-slate-400"
                          }`}
                        >
                          /
                        </span>
                      )}
                      {isLast ? (
                        <span
                          className={`font-bold truncate max-w-[140px] sm:max-w-[220px] ${
                            variant === "navy" ? "text-[#A3F65C]" : "text-[#051F16]"
                          }`}
                          title={crumb.label}
                        >
                          {crumb.label}
                        </span>
                      ) : (
                        <button
                          onClick={() => crumb.screen && navigate(crumb.screen)}
                          className={`truncate max-w-[100px] sm:max-w-[160px] font-medium transition-colors cursor-pointer hover:underline ${
                            variant === "navy"
                              ? "text-slate-300 hover:text-white"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                          title={`Go to ${crumb.label}`}
                        >
                          {crumb.label}
                        </button>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            ) : (
              /* Clean Reference Nav Links (on Home Screen Desktop) */
              <div className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-slate-600 pl-4">
                <a
                  href="#marketplace"
                  className="hover:text-[#051F16] transition-colors cursor-pointer"
                >
                  Products
                </a>
                <a
                  href="#solutions"
                  className="hover:text-[#051F16] transition-colors cursor-pointer"
                >
                  Solutions
                </a>
                <a
                  href="#how-it-works"
                  className="hover:text-[#051F16] transition-colors cursor-pointer"
                >
                  How MPI Works
                </a>
                <button
                  type="button"
                  onClick={() =>
                    handleRequestAuth({
                      mode: "login",
                      defaultRole: "startup",
                      targetScreen: "startup.home",
                      portalContext: {
                        badge: "Startup Buyer Portal",
                        title: "Log in for Startups",
                        description:
                          "Access verified MSME suppliers, AI procurement copilot, live RFQ generator & order escrow.",
                        icon: "rocket_launch",
                      },
                    })
                  }
                  className="hover:text-[#051F16] transition-colors cursor-pointer"
                >
                  For Startups
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRequestAuth({
                      mode: "login",
                      defaultRole: "msme",
                      targetScreen: "msme.home",
                      portalContext: {
                        badge: "MSME Supplier Network",
                        title: "Log in for MSMEs",
                        description:
                          "Access verified OEM purchase orders, active startup tenders, and escrow payments.",
                        icon: "precision_manufacturing",
                      },
                    })
                  }
                  className="hover:text-[#051F16] transition-colors cursor-pointer"
                >
                  For MSMEs
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRequestAuth({
                      mode: "login",
                      defaultRole: "startup",
                      targetScreen: "government-schemes.match",
                      portalContext: {
                        badge: "Government Schemes Engine",
                        title: "Log in for Government Schemes",
                        description:
                          "Match your enterprise against 30+ central subsidies (SISFS, CGTMSE, ZED) & track disbursements.",
                        icon: "policy",
                      },
                    })
                  }
                  className="hover:text-[#051F16] transition-colors cursor-pointer flex items-center gap-1.5 text-slate-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A3F65C] ring-1 ring-emerald-600/30" />
                  <span>Govt Schemes</span>
                </button>
              </div>
            )}
          </div>

          {/* Right section: Hub Links, Translator & Action CTA Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop Hub Links (inside Sub-portals) */}
            {!isHomeScreen && showQuickLinks && (
              <div className="hidden xl:flex items-center gap-1">
                {navHubs.map((hub) => {
                  const active = isCurrentHub(hub.screen)
                  return (
                    <button
                      key={hub.screen}
                      onClick={() => navigate(hub.screen)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                        active
                          ? variant === "navy"
                            ? "bg-[#0A3525] text-[#A3F65C] border border-emerald-800/60 shadow-xs"
                            : "bg-[#051F16] text-white shadow-xs"
                          : variant === "navy"
                          ? "text-slate-300 hover:bg-[#0A3525] hover:text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <MaterialIcon name={hub.iconName} size={15} />
                      <span>{hub.label}</span>
                      {hub.badge && !active && (
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                            variant === "navy"
                              ? "bg-[#0A3525] text-[#A3F65C]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {hub.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Global Language Translator Button (Globe + EN) */}
            <LanguageTranslatorButton variant={variant === "navy" ? "navy" : "default"} />

            {/* Direct High-Intent Action CTAs (Reference Match) */}
            {isHomeScreen ? (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleRequestAuth({
                      mode: "login",
                      defaultRole: "startup",
                      targetScreen: "startup.home",
                    })
                  }
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-150 cursor-pointer ${
                    variant === "navy"
                      ? "text-slate-200 hover:text-white hover:bg-white/10"
                      : "text-slate-700 hover:text-[#051F16] hover:bg-slate-100 border border-slate-200/90 shadow-2xs hover:shadow-xs"
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleRequestAuth({
                      mode: isScrolled ? "login" : "signin",
                      defaultRole: "startup",
                      targetScreen: isScrolled ? "startup.procurement" : "startup.home",
                      portalContext: isScrolled
                        ? {
                            badge: "Startup Buyer Portal",
                            title: "Start a Procurement Request",
                            description: "Log in or register your startup to synthesize engineering specs and match verified factories.",
                            icon: "rocket_launch",
                          }
                        : undefined,
                    })
                  }
                  aria-label={isScrolled ? "Start a Procurement Request" : "Sign In to MPI"}
                  className="group inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold rounded-xl bg-[#051F16] hover:bg-[#083A28] active:bg-[#051F16] text-white shadow-[0_2px_10px_rgba(5,31,22,0.18)] hover:shadow-[0_4px_16px_rgba(5,31,22,0.28)] border border-[#0A3525] active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  {isScrolled && (
                    <MaterialIcon name="auto_awesome" size={13} className="text-[#A3F65C]" />
                  )}
                  <span>{isScrolled ? "Start Procurement" : "Sign In"}</span>
                  <Icons.ArrowRight className="w-3.5 h-3.5 text-[#A3F65C] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            ) : (
              /* Hub Switcher Dropdown for non-home pages */
              <div className="hidden sm:flex xl:hidden items-center">
                <select
                  aria-label="Switch Hub"
                  value={
                    isHomeScreen
                      ? "home"
                      : currentScreen.startsWith("startup.")
                      ? "startup.home"
                      : currentScreen.startsWith("msme.")
                      ? "msme.home"
                      : currentScreen.startsWith("government-schemes.")
                      ? "government-schemes.match"
                      : currentScreen.startsWith("analytics.")
                      ? "analytics.detail.ai-insights"
                      : currentScreen.startsWith("admin.")
                      ? "admin.home"
                      : "home"
                  }
                  onChange={(e) => navigate(e.target.value as Screen)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#051F16] ${
                    variant === "navy"
                      ? "bg-[#083A28] text-white border-emerald-900/40"
                      : "bg-slate-100 text-slate-800 border-slate-200"
                  }`}
                >
                  <option value="home">Home Marketplace</option>
                  {!currentScreen.startsWith("msme.") && (
                    <option value="startup.home">Startup Hub (Buyer)</option>
                  )}
                  {!currentScreen.startsWith("startup.") && (
                    <option value="msme.home">MSME Portal (Supplier)</option>
                  )}
                  <option value="government-schemes.match">Government Schemes</option>
                  <option value="analytics.detail.ai-insights">Analytics Studio</option>
                  <option value="admin.home">Admin Portal</option>
                </select>
              </div>
            )}

            {/* Mobile Menu Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-1.5 rounded-lg border sm:hidden transition-colors cursor-pointer ${
                variant === "navy"
                  ? "border-[#0A3525] text-slate-200 hover:bg-[#083A28]"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown Drawer */}
      {mobileMenuOpen && (
        <div
          className={`sm:hidden border-t px-4 py-4 space-y-2 animate-fade-in ${
            variant === "navy"
              ? "bg-[#051F16] border-[#0A3525]"
              : "bg-white border-slate-200 shadow-xl"
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Navigation & Platform Portals
          </div>
          {navHubs.map((hub) => {
            const active = isCurrentHub(hub.screen)

            const handleMobileItemClick = () => {
              if (hub.screen === "startup.home") {
                handleRequestAuth({
                  mode: "login",
                  defaultRole: "startup",
                  targetScreen: "startup.home",
                  portalContext: {
                    badge: "Startup Buyer Portal",
                    title: "Log in for Startups",
                    description:
                      "Access verified MSME suppliers, AI procurement copilot, live RFQ generator & order escrow.",
                    icon: "rocket_launch",
                  },
                })
              } else if (hub.screen === "msme.home") {
                handleRequestAuth({
                  mode: "login",
                  defaultRole: "msme",
                  targetScreen: "msme.home",
                  portalContext: {
                    badge: "MSME Supplier Network",
                    title: "Log in for MSMEs",
                    description:
                      "Access verified OEM purchase orders, active startup tenders, and escrow payments.",
                    icon: "precision_manufacturing",
                  },
                })
              } else if (hub.screen === "government-schemes.match") {
                handleRequestAuth({
                  mode: "login",
                  defaultRole: "startup",
                  targetScreen: "government-schemes.match",
                  portalContext: {
                    badge: "Government Schemes Engine",
                    title: "Log in for Government Schemes",
                    description:
                      "Match your enterprise against central subsidies (SISFS, CGTMSE, ZED) & track disbursements.",
                    icon: "policy",
                  },
                })
              } else {
                navigate(hub.screen)
                setMobileMenuOpen(false)
              }
            }

            return (
              <button
                key={hub.screen}
                onClick={handleMobileItemClick}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  active
                    ? "bg-[#051F16] text-white"
                    : variant === "navy"
                    ? "text-slate-200 hover:bg-[#083A28]"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MaterialIcon name={hub.iconName} size={16} />
                  <span>{hub.label}</span>
                </div>
                {hub.badge && (
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                    {hub.badge}
                  </span>
                )}
              </button>
            )
          })}

          {/* Direct CTA on Mobile */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                handleRequestAuth({
                  mode: "signin",
                  defaultRole: "startup",
                  targetScreen: "startup.home",
                })
              }}
              className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-[#051F16] hover:bg-[#083A28] text-white flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <span>Sign In</span>
              <Icons.ArrowRight className="w-3.5 h-3.5 text-[#A3F65C]" />
            </button>
            <button
              type="button"
              onClick={() => {
                handleRequestAuth({
                  mode: "login",
                  defaultRole: "startup",
                  targetScreen: "startup.home",
                })
              }}
              className="w-full py-2.5 px-4 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 transition-colors cursor-pointer"
            >
              Log In
            </button>
          </div>
        </div>
      )}

      {/* Fallback Internal Auth Modal when onOpenAuth is not supplied by parent */}
      {!onOpenAuth && (
        <AuthModal
          isOpen={internalAuthModal.open}
          initialMode={internalAuthModal.mode}
          initialRole={internalAuthModal.defaultRole}
          targetScreen={internalAuthModal.targetScreen}
          portalContext={internalAuthModal.portalContext}
          onClose={() => setInternalAuthModal((prev) => ({ ...prev, open: false }))}
          navigate={navigate}
        />
      )}
    </nav>
  )
}
