/**
 * All pages. Each role has its own area (/startup, /supplier, /admin) inside
 * the shared frame; "/" sends people to login or to their own area.
 * Menu pages show a placeholder until their screen is built.
 */

import { createBrowserRouter, Navigate, type RouteObject } from "react-router"
import ForgotPasswordPage from "../screens/auth/ForgotPasswordPage"
import LoginPage from "../screens/auth/LoginPage"
import ResetPasswordPage from "../screens/auth/ResetPasswordPage"
import SignupPage from "../screens/auth/SignupPage"
import NotFound from "../screens/NotFound"
import OrdersPage from "../screens/orders/OrdersPage"
import NotificationsPage from "../screens/notifications/NotificationsPage"
import StartupOverview from "../screens/overview/StartupOverview"
import AdminOverview from "../screens/overview/AdminOverview"
import SupplierOverview from "../screens/overview/SupplierOverview"
import Placeholder from "../screens/Placeholder"
import MatchesPage from "../screens/admin/MatchesPage"
import OrdersAdminPage from "../screens/admin/OrdersAdminPage"
import VerificationPage from "../screens/admin/VerificationPage"
import PaymentTermsPage from "../screens/admin/PaymentTermsPage"
import SchemesPage from "../screens/schemes/SchemesPage"
import AdminProfilePage from "../screens/profile/AdminProfilePage"
import StartupProfilePage from "../screens/profile/StartupProfilePage"
import SupplierProfilePage from "../screens/profile/SupplierProfilePage"
import MyRequestsPage from "../screens/startup/MyRequestsPage"
import QuotePage from "../screens/supplier/QuotePage"
import SupplierRequestsPage from "../screens/supplier/RequestsPage"
import NewRequestPage from "../screens/startup/new-request/NewRequestPage"
import RequestDetailPage from "../screens/startup/request/RequestDetailPage"
import FullPageMessage from "../ui/FullPageMessage"
import AppShell from "./AppShell"
import { MENUS } from "./menus"
import RequireRole from "./RequireRole"
import { homeFor, useSession, type Role } from "./session"

function Home() {
  const { state } = useSession()
  if (state.status === "loading") return <FullPageMessage loading title="Loading MPI" />
  if (state.status === "signedIn") return <Navigate to={homeFor(state.role)} replace />
  return <Navigate to="/login" replace />
}

/** Screens built so far, by area and path. Other menu pages show a placeholder. */
const SCREENS: Partial<Record<Role, RouteObject[]>> = {
  startup: [
    { index: true, element: <StartupOverview /> },
    { path: "requests", element: <MyRequestsPage /> },
    { path: "requests/new", element: <NewRequestPage /> },
    { path: "requests/:requestId", element: <RequestDetailPage /> },
    { path: "orders", element: <OrdersPage side="startup" /> },
    { path: "notifications", element: <NotificationsPage role="startup" /> },
    { path: "schemes", element: <SchemesPage audience="startup" /> },
    { path: "profile", element: <StartupProfilePage /> },
  ],
  vendor: [
    { index: true, element: <SupplierOverview /> },
    { path: "requests", element: <SupplierRequestsPage /> },
    { path: "requests/:invitationId", element: <QuotePage /> },
    { path: "orders", element: <OrdersPage side="vendor" /> },
    { path: "notifications", element: <NotificationsPage role="vendor" /> },
    { path: "schemes", element: <SchemesPage audience="vendor" /> },
    { path: "profile", element: <SupplierProfilePage /> },
  ],
  // Not in the admin menu; opened from the account menu.
  admin: [
    { index: true, element: <AdminOverview /> },
    { path: "matches", element: <MatchesPage /> },
    { path: "verification", element: <VerificationPage /> },
    { path: "payment-terms", element: <PaymentTermsPage /> },
    { path: "orders", element: <OrdersAdminPage /> },
    { path: "notifications", element: <NotificationsPage role="admin" /> },
    { path: "profile", element: <AdminProfilePage /> },
  ],
}

/** A role's area: its guard, the frame, its built screens and a placeholder for the rest. */
function area(role: Role): RouteObject {
  const menu = MENUS[role]
  const built = SCREENS[role] ?? []
  const builtPaths = new Set(built.map((r) => (r.index ? "" : r.path)))
  return {
    path: menu.area,
    element: <RequireRole role={role} />,
    children: [
      {
        element: <AppShell role={role} />,
        children: [
          ...built,
          ...menu.items
            .filter((item) => !builtPaths.has(item.to))
            .map((item): RouteObject =>
              item.to
                ? { path: item.to, element: <Placeholder title={item.label} /> }
                : { index: true, element: <Placeholder title={item.label} /> },
            ),
        ],
      },
    ],
  }
}

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  area("startup"),
  area("vendor"),
  area("admin"),
  { path: "*", element: <NotFound /> },
])
