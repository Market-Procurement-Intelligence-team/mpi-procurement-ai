import { useState, useCallback, useEffect, lazy, Suspense } from "react"
import { getAdminSession, ADMIN_CONFIG } from "./lib/mockAuth"
import { ProcurementProvider } from "./context/ProcurementContext"
import Home from "./screens/Home"
import Landing from "./screens/Landing"
import LoginPortal from "./screens/Login"

// Code-split heavy application flows to optimize initial bundle size
const StartupFlow = lazy(() => import("./screens/startup/StartupFlow"))
const MSMEFlow = lazy(() => import("./screens/msme/MSMEFlow"))
const AdminFlow = lazy(() => import("./screens/admin/AdminFlow"))
const GovernmentSchemesFlow = lazy(() => import("./screens/schemes/GovernmentSchemesFlow"))
const StartupOnboarding = lazy(() => import("./screens/onboarding/StartupOnboarding"))
const MSMEOnboarding = lazy(() => import("./screens/onboarding/MSMEOnboarding"))

// Lazy-loaded analytics subpages
const AIInsightsDetailPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.AIInsightsDetailPage }))
)
const TotalSalesDetailPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.TotalSalesDetailPage }))
)
const RevenueComparisonDetailPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.RevenueComparisonDetailPage }))
)
const SalesTrendDetailPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.SalesTrendDetailPage }))
)
const AgeRangeDetailPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.AgeRangeDetailPage }))
)
const AddWidgetStudioPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.AddWidgetStudioPage }))
)
const CreateReportPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.CreateReportPage }))
)
const PulseLiveFeedPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.PulseLiveFeedPage }))
)
const DataCatalogPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.DataCatalogPage }))
)
const SharedTeamPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.SharedTeamPage }))
)
const NotificationsPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.NotificationsPage }))
)
const MessagesPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.MessagesPage }))
)
const DocumentsPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.DocumentsPage }))
)
const SupportPage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.SupportPage }))
)
const AccountProfilePage = lazy(() =>
  import("./screens/analytics/AnalyticsDetailPages").then((m) => ({ default: m.AccountProfilePage }))
)

function FlowLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-600 tracking-wider uppercase font-mono">
          Loading MPI Workspace...
        </p>
      </div>
    </div>
  )
}

import GlobalNavBar from "./components/navigation/GlobalNavBar"
import ErrorBoundary from "./components/ui/ErrorBoundary"
import CookieConsentExperience from "./components/cookie/CookieConsentExperience"

export type Screen = "home" | "landing" | "login.startup" | "login.msme" | "login.admin" | "register.startup" | "register.msme" | "government-schemes.match" | "government-schemes.browse" | "government-schemes.detail" | "analytics.detail.ai-insights" | "analytics.detail.total-sales" | "analytics.detail.revenue-comparison" | "analytics.detail.sales-trend" | "analytics.detail.age-range" | "analytics.add-widget" | "analytics.create-report" | "analytics.pulse" | "analytics.data" | "analytics.shared" | "analytics.notifications" | "analytics.messages" | "analytics.documents" | "analytics.support" | "analytics.profile" | "startup.home" | "startup.onboarding" | "startup.procurement" | "startup.ai-assistant" | "startup.ai-analysis" | "startup.match-results" | "startup.supplier-detail" | "startup.comparison" | "startup.shortlist" | "startup.rfq" | "startup.samples" | "startup.sample-new" | "startup.schemes" | "startup.status" | "startup.history" | "startup.profile" | "startup.settings" | "startup.analytics" | "msme.home" | "msme.onboarding" | "msme.profile" | "msme.capabilities" | "msme.products" | "msme.certifications" | "msme.verification" | "msme.verification-status" | "msme.match-readiness" | "msme.opportunities" | "msme.opportunity-detail" | "msme.proposal" | "msme.procurement-status" | "msme.schemes" | "msme.analytics" | "msme.settings" | "admin.home" | "admin.user-management" | "admin.startup-management" | "admin.msme-management" | "admin.verification" | "admin.procurement" | "admin.ai-matching" | "admin.analytics" | "admin.reports" | "admin.settings"

export const VALID_SCREENS = new Set<Screen>([
  "home",
  "landing",
  "login.startup",
  "login.msme",
  "login.admin",
  "register.startup",
  "register.msme",
  "government-schemes.match",
  "government-schemes.browse",
  "government-schemes.detail",
  "analytics.detail.ai-insights",
  "analytics.detail.total-sales",
  "analytics.detail.revenue-comparison",
  "analytics.detail.sales-trend",
  "analytics.detail.age-range",
  "analytics.add-widget",
  "analytics.create-report",
  "analytics.pulse",
  "analytics.data",
  "analytics.shared",
  "analytics.notifications",
  "analytics.messages",
  "analytics.documents",
  "analytics.support",
  "analytics.profile",
  "startup.home",
  "startup.onboarding",
  "startup.procurement",
  "startup.ai-assistant",
  "startup.ai-analysis",
  "startup.match-results",
  "startup.supplier-detail",
  "startup.comparison",
  "startup.shortlist",
  "startup.rfq",
  "startup.samples",
  "startup.sample-new",
  "startup.schemes",
  "startup.status",
  "startup.history",
  "startup.profile",
  "startup.settings",
  "startup.analytics",
  "msme.home",
  "msme.onboarding",
  "msme.profile",
  "msme.capabilities",
  "msme.products",
  "msme.certifications",
  "msme.verification",
  "msme.verification-status",
  "msme.match-readiness",
  "msme.opportunities",
  "msme.opportunity-detail",
  "msme.proposal",
  "msme.procurement-status",
  "msme.schemes",
  "msme.analytics",
  "msme.settings",
  "admin.home",
  "admin.user-management",
  "admin.startup-management",
  "admin.msme-management",
  "admin.verification",
  "admin.procurement",
  "admin.ai-matching",
  "admin.analytics",
  "admin.reports",
  "admin.settings",
])

export interface NavProps {
  navigate: (screen: Screen) => void
  goBack: () => void
  currentScreen: Screen
  canGoBack: boolean
}

function isAdminPath(): boolean {
  if (typeof window === "undefined") return false
  const p = window.location.pathname.toLowerCase()
  return (
    p === "/1982/admin" ||
    p === "/1982/admin/" ||
    p.startsWith("/1982/admin")
  )
}

function getInitialScreen(): Screen {
  if (isAdminPath()) {
    return getAdminSession() ? "admin.home" : "login.admin"
  }
  if (typeof window !== "undefined") {
    // 1. Direct deep-link URL hash (e.g., /#startup.procurement)
    const hashScreen = window.location.hash.replace(/^#\/?/, "") as Screen
    if (VALID_SCREENS.has(hashScreen)) {
      if (hashScreen.startsWith("admin.") && !getAdminSession()) {
        return "login.admin"
      }
      return hashScreen
    }
    // 2. Session storage fallback for browser refresh preservation
    try {
      const saved = sessionStorage.getItem("mpi_current_screen") as Screen
      if (saved && VALID_SCREENS.has(saved)) {
        if (saved.startsWith("admin.") && !getAdminSession()) {
          return "login.admin"
        }
        return saved
      }
    } catch {
      // Ignore storage access restrictions
    }
  }
  return "home"
}

export default function App() {
  const [history, setHistory] = useState<Screen[]>([getInitialScreen()])
  const currentScreen = history[history.length - 1]
  const canGoBack = history.length > 1

  const navigate = useCallback((screen: Screen) => {
    // Admin route protection: gate any admin screen if unauthenticated
    let targetScreen = screen
    if (screen.startsWith("admin.") && !getAdminSession()) {
      targetScreen = "login.admin"
    }

    const updateState = () => {
      setHistory((prev) => [...prev, targetScreen])
    }

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      ;(document as any).startViewTransition(updateState)
    } else {
      updateState()
    }
    window.scrollTo({ top: 0, behavior: "smooth" })

    // Sync session storage and browser URL
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("mpi_current_screen", targetScreen)
      } catch {
        // Ignore session storage errors
      }

      if (targetScreen.startsWith("admin.") || targetScreen === "login.admin") {
        if (window.location.pathname !== ADMIN_CONFIG.path) {
          window.history.pushState(null, "", ADMIN_CONFIG.path)
        }
      } else if (targetScreen === "home") {
        if (window.location.hash) {
          window.history.pushState(null, "", window.location.pathname)
        }
      } else {
        window.location.hash = targetScreen
      }
    }
  }, [])

  const goBack = useCallback(() => {
    const updateState = () => {
      setHistory((prev) => {
        if (prev.length > 1) {
          const next = prev.slice(0, -1)
          const newCurrent = next[next.length - 1]
          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem("mpi_current_screen", newCurrent)
            } catch {}
            if (newCurrent === "home") {
              window.history.pushState(null, "", window.location.pathname)
            } else {
              window.location.hash = newCurrent
            }
          }
          return next
        }
        // Intelligent fallback when user opened directly or refreshed
        const current = prev[0] || "home"
        if (current.startsWith("startup.") && current !== "startup.home") {
          return ["home", "startup.home"]
        }
        if (current.startsWith("msme.") && current !== "msme.home") {
          return ["home", "msme.home"]
        }
        if (current.startsWith("admin.") && current !== "admin.home") {
          return ["home", "admin.home"]
        }
        if (current.startsWith("analytics.")) {
          return ["home", "startup.analytics"]
        }
        if (current.startsWith("government-schemes.")) {
          return ["home"]
        }
        if (current.startsWith("login.") || current.startsWith("register.") || current.includes("onboarding")) {
          return ["home"]
        }
        return ["home"]
      })
    }

    if (typeof document !== "undefined" && "startViewTransition" in document) {
      ;(document as any).startViewTransition(updateState)
    } else {
      updateState()
    }
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  // Sync URL popstate and initial route
  useEffect(() => {
    const handlePopState = () => {
      if (isAdminPath()) {
        const nextScreen: Screen = getAdminSession() ? "admin.home" : "login.admin"
        setHistory((prev) => [...prev, nextScreen])
      } else if (window.location.pathname === "/" && !window.location.hash) {
        setHistory((prev) => [...prev, "home"])
      }
    }

    const handleHashChange = () => {
      const hashScreen = window.location.hash.replace(/^#\/?/, "") as Screen
      if (VALID_SCREENS.has(hashScreen)) {
        if (hashScreen.startsWith("admin.") && !getAdminSession()) {
          setHistory((prev) => [...prev, "login.admin"])
        } else {
          setHistory((prev) => [...prev, hashScreen])
        }
      }
    }

    window.addEventListener("popstate", handlePopState)
    window.addEventListener("hashchange", handleHashChange)

    if (isAdminPath() && window.location.pathname !== ADMIN_CONFIG.path) {
      window.history.replaceState(null, "", ADMIN_CONFIG.path)
    }

    return () => {
      window.removeEventListener("popstate", handlePopState)
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [])

  const navProps: NavProps = { navigate, goBack, currentScreen, canGoBack }

  const renderActiveScreen = () => {
    // Flagship Analytics Detail Pages (All buttons in Bento dashboard)
    if (currentScreen.startsWith("analytics.")) {
      let pageContent: React.ReactNode = null
      if (currentScreen === "analytics.detail.ai-insights")
        pageContent = <AIInsightsDetailPage {...navProps} />
      else if (currentScreen === "analytics.detail.total-sales")
        pageContent = <TotalSalesDetailPage {...navProps} />
      else if (currentScreen === "analytics.detail.revenue-comparison")
        pageContent = <RevenueComparisonDetailPage {...navProps} />
      else if (currentScreen === "analytics.detail.sales-trend")
        pageContent = <SalesTrendDetailPage {...navProps} />
      else if (currentScreen === "analytics.detail.age-range")
        pageContent = <AgeRangeDetailPage {...navProps} />
      else if (currentScreen === "analytics.add-widget")
        pageContent = <AddWidgetStudioPage {...navProps} />
      else if (currentScreen === "analytics.create-report")
        pageContent = <CreateReportPage {...navProps} />
      else if (currentScreen === "analytics.pulse")
        pageContent = <PulseLiveFeedPage {...navProps} />
      else if (currentScreen === "analytics.data")
        pageContent = <DataCatalogPage {...navProps} />
      else if (currentScreen === "analytics.shared")
        pageContent = <SharedTeamPage {...navProps} />
      else if (currentScreen === "analytics.notifications")
        pageContent = <NotificationsPage {...navProps} />
      else if (currentScreen === "analytics.messages")
        pageContent = <MessagesPage {...navProps} />
      else if (currentScreen === "analytics.documents")
        pageContent = <DocumentsPage {...navProps} />
      else if (currentScreen === "analytics.support")
        pageContent = <SupportPage {...navProps} />
      else if (currentScreen === "analytics.profile")
        pageContent = <AccountProfilePage {...navProps} />

      return (
        <div className="min-h-screen bg-[#F7F9FC] flex flex-col font-sans">
          <GlobalNavBar {...navProps} />
          <div className="flex-1">{pageContent}</div>
        </div>
      )
    }

    // Specialized Onboarding Flows
    if (
      currentScreen === "register.startup" ||
      currentScreen === "startup.onboarding"
    ) {
      return <StartupOnboarding {...navProps} />
    }
    if (
      currentScreen === "register.msme" ||
      currentScreen === "msme.onboarding"
    ) {
      return <MSMEOnboarding {...navProps} />
    }

    // Central Government Schemes Intelligence Engine
    if (currentScreen.startsWith("government-schemes.")) {
      return <GovernmentSchemesFlow {...navProps} />
    }

    // Main Root Screens
    if (currentScreen === "home") return <Home {...navProps} />
    if (currentScreen === "landing") return <Landing {...navProps} />
    if (
      currentScreen.startsWith("login.") ||
      currentScreen.startsWith("register.")
    )
      return <LoginPortal {...navProps} />
    if (currentScreen.startsWith("startup."))
      return <StartupFlow {...navProps} />
    if (currentScreen.startsWith("msme.")) return <MSMEFlow {...navProps} />
    if (currentScreen.startsWith("admin.")) {
      if (!getAdminSession()) {
        return <LoginPortal {...navProps} currentScreen="login.admin" />
      }
      return <AdminFlow {...navProps} />
    }

    return <Landing {...navProps} />
  }

  return (
    <ErrorBoundary>
      <ProcurementProvider>
        <Suspense fallback={<FlowLoadingFallback />}>
          {renderActiveScreen()}
        </Suspense>
        <CookieConsentExperience />
      </ProcurementProvider>
    </ErrorBoundary>
  )
}
