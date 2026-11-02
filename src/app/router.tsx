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
import Placeholder from "../screens/Placeholder"
import AdminProfilePage from "../screens/profile/AdminProfilePage"
import StartupProfilePage from "../screens/profile/StartupProfilePage"
import SupplierProfilePage from "../screens/profile/SupplierProfilePage"
import MyRequestsPage from "../screens/startup/MyRequestsPage"
import NewRequestPage from "../screens/startup/new-request/NewRequestPage"
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
    { path: "requests", element: <MyRequestsPage /> },
    { path: "requests/new", element: <NewRequestPage /> },
    { path: "profile", element: <StartupProfilePage /> },
  ],
  vendor: [{ path: "profile", element: <SupplierProfilePage /> }],
  // Not in the admin menu; opened from the account menu.
  admin: [{ path: "profile", element: <AdminProfilePage /> }],
}

/** A role's area: its guard, the frame, its built screens and a placeholder for the rest. */
function area(role: Role): RouteObject {
  const menu = MENUS[role]
  const built = SCREENS[role] ?? []
  const builtPaths = new Set(built.map((r) => r.path))
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
